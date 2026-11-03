import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import * as gcpStorage from "./gcp-storage";
import { requestUserId, trackHandler } from "./security";

async function getUserIdFromRequest(req: Request): Promise<string> {
  return requestUserId(req);
}

export function registerPracticeRoutes(app: Express): void {
  // ============================================
  // VOICE CHALLENGE ENDPOINTS
  // ============================================

  // Get active voice challenge for current user
  app.get("/api/voice-challenges/active", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const challenge = await storage.getActiveVoiceChallenge(userId);
      res.json(challenge || null);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch active challenge" });
    }
  }));

  // Get all voice challenges for current user
  app.get("/api/voice-challenges", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const challenges = await storage.getVoiceChallenges(userId);
      res.json(challenges);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  }));

  // Get a specific voice challenge
  app.get("/api/voice-challenges/:id", trackHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const challenge = await storage.getVoiceChallenge(id);
      if (!challenge || challenge.userId !== requestUserId(req)) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      res.json(challenge);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch challenge" });
    }
  }));

  // Generate a new voice challenge
  app.post("/api/voice-challenges/generate", trackHandler(async (req: Request, res: Response) => {
    try {
      const { generateChallengePrompt } = await import("./gemini-challenge");
      const userId = await getUserIdFromRequest(req);

      // Check user's demo data preference
      const user = await storage.getUser(userId);
      const demoDataEnabled = user?.demoDataEnabled ?? true; // Default to true for backward compatibility

      // Get a random user fact (or use provided one)
      let userFact = await storage.getRandomUserFact(userId);

      // Only create demo facts if demo mode is enabled
      if (!userFact && demoDataEnabled) {
        const demoFacts = [
          { content: "User loves traveling and has visited Japan twice", category: "preference" },
          { content: "User enjoys cooking Italian food on weekends", category: "hobby" },
          { content: "User is learning to play guitar", category: "skill" },
          { content: "User works in software development", category: "work" },
          { content: "User has a golden retriever named Max", category: "personal" },
        ];

        for (const fact of demoFacts) {
          await storage.createUserFact({
            userId,
            content: fact.content,
            category: fact.category,
          });
        }
        userFact = await storage.getRandomUserFact(userId);
      }

      if (!userFact) {
        // Different error message based on demo mode
        if (demoDataEnabled) {
          return res.status(500).json({ error: "Failed to get user fact" });
        } else {
          return res.status(400).json({
            error: "No Omi memories found",
            message: "Connect your Omi device and say 'lingua learn' to create memories, or enable Demo Mode in Settings."
          });
        }
      }

      // Generate challenge prompt using Gemini
      const targetLanguage = req.body.targetLanguage || user?.targetLanguage || "Spanish";
      const generated = await generateChallengePrompt(userFact, targetLanguage);

      // Create the challenge
      const challenge = await storage.createVoiceChallenge({
        userId,
        status: "active",
        sourceFact: userFact.content,
        sourceFactId: userFact.id.toString(),
        prompt: generated.prompt,
        languageGoal: generated.languageGoal,
        targetLanguage,
        difficulty: generated.difficulty,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Update fact usage
      await storage.updateUserFactUsage(userFact.id);

      res.json(challenge);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to generate challenge" });
    }
  }));

  // Submit response to a voice challenge
  app.post("/api/voice-challenges/:id/respond", trackHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { transcript, audioUri } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const challenge = await storage.getVoiceChallenge(id);
      if (!challenge || challenge.userId !== requestUserId(req)) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      if (challenge.status !== "active") return res.status(409).json({ error: "Challenge already resolved" });
      if (typeof transcript !== "string" || transcript.length > 12000) return res.status(400).json({ error: "Invalid transcript" });
      if (audioUri !== undefined) {
        const registered = await storage.getCompiledAudioFiles(requestUserId(req));
        if (typeof audioUri !== "string" || !registered.some(f => f.gcpUri === audioUri)) return res.status(403).json({ error: "Audio is not registered to this account" });
        gcpStorage.authorizedObjectPath(audioUri);
      }
      // Analyze the response with Gemini
      const { analyzeChallengeResponse } = await import("./gemini-challenge");
      const feedback = await analyzeChallengeResponse(challenge, transcript, audioUri);

      // Complete the challenge
      const completed = await storage.completeVoiceChallenge(id, {
        transcript,
        audioUri,
        feedback,
      });

      // Create learning items from corrections
      if (feedback.corrections && feedback.corrections.length > 0) {
        const userId = await getUserIdFromRequest(req);
        for (const correction of feedback.corrections) {
          await storage.createLearningItem({
            userId,
            originalText: correction.original,
            correctedText: correction.corrected,
            explanation: correction.explanation,
            category: correction.category,
          });
        }
      }

      // Update user XP
      if (completed?.xpEarned) {
        const userId = await getUserIdFromRequest(req);
        const user = await storage.getUser(userId);
        if (user) {
          await storage.updateUserStats(userId, {
            totalXp: (user.totalXp || 0) + completed.xpEarned,
          });
        }
      }

      res.json({
        challenge: completed,
        feedback,
      });
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to submit response" });
    }
  }));

  // Regenerate/skip a challenge and get a new one
  app.post("/api/voice-challenges/:id/regenerate", trackHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Mark current challenge as skipped
      const existingChallenge = await storage.getVoiceChallenge(id);
      if (!existingChallenge || existingChallenge.userId !== requestUserId(req)) return res.status(404).json({ error: "Challenge not found" });
      if (existingChallenge) {
        await storage.updateVoiceChallenge(id, { status: "skipped" });
      }

      // Get a different fact (avoid the one just used)
      const userId = await getUserIdFromRequest(req);
      const facts = await storage.getUserFacts(userId);
      const availableFacts = facts.filter(f =>
        !existingChallenge?.sourceFactId || f.id.toString() !== existingChallenge.sourceFactId
      );

      if (availableFacts.length === 0) {
        return res.status(400).json({ error: "No alternative facts available" });
      }

      // Pick a random fact from available ones
      const userFact = availableFacts[Math.floor(Math.random() * availableFacts.length)];

      // Generate new challenge
      const user = await storage.getUser(userId);
      const { generateChallengePrompt } = await import("./gemini-challenge");
      const targetLanguage = req.body.targetLanguage || user?.targetLanguage || "Spanish";
      const generated = await generateChallengePrompt(userFact, targetLanguage);

      const challenge = await storage.createVoiceChallenge({
        userId,
        status: "active",
        sourceFact: userFact.content,
        sourceFactId: userFact.id.toString(),
        prompt: generated.prompt,
        languageGoal: generated.languageGoal,
        targetLanguage,
        difficulty: generated.difficulty,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await storage.updateUserFactUsage(userFact.id);

      res.json(challenge);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to regenerate challenge" });
    }
  }));

  // ============================================
  // USER FACTS ENDPOINTS
  // ============================================

  // Get all user facts
  app.get("/api/user-facts", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const facts = await storage.getUserFacts(userId);
      res.json(facts);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch user facts" });
    }
  }));

  // Add a user fact manually
  app.post("/api/user-facts", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const { content, category } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const fact = await storage.createUserFact({
        userId,
        content,
        category: category || "general",
      });

      res.status(201).json(fact);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to create user fact" });
    }
  }));

  // Sync facts from Omi API (placeholder - requires Omi API key)
  app.post("/api/user-facts/sync-omi", trackHandler((_req, res) => res.status(501).json({ error: "Direct Omi sync is not implemented. Use authenticated memory callbacks." })));
}
