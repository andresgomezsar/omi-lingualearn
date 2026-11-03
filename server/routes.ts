import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenAI } from "@google/genai";
import * as gcpStorage from "./gcp-storage";
import { installSecurity, requestUserId, publicUser, publicOrigin, operatorUser, trackHandler } from "./security";
import { ingestAudio, audioPool } from "./audio-ingestion";

// Using direct Gemini API key from Google
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;


async function getUserIdFromRequest(req: Request): Promise<string> {
  return requestUserId(req);
}

/**
 * Check if a speaker name is a real name (not generic like "Speaker 0", "Speaker 1", etc.)
 * Returns true if the name appears to be a real person's name
 */
function isRealSpeakerName(speaker: string | null | undefined): boolean {
  if (!speaker) return false;
  
  const trimmed = speaker.trim();
  if (trimmed.length < 2) return false;
  
  // Generic speaker patterns to reject (comprehensive list)
  const genericPatterns = [
    /^speaker[\s\-_]*\d*$/i,      // "Speaker", "Speaker 0", "Speaker-1", "speaker_02"
    /^user[\s\-_]*\d*$/i,         // "User", "User 1", "user-2"
    /^person[\s\-_]*\d*$/i,       // "Person", "Person 1"
    /^voice[\s\-_]*\d*$/i,        // "Voice", "Voice 1"
    /^participant[\s\-_]*\d*$/i,  // "Participant", "Participant 1"
    /^attendee[\s\-_]*\d*$/i,     // "Attendee", "Attendee 1"
    /^guest[\s\-_]*\d*$/i,        // "Guest", "Guest 1"
    /^caller[\s\-_]*\d*$/i,       // "Caller", "Caller 1"
    /^member[\s\-_]*\d*$/i,       // "Member", "Member 1"
    /^host[\s\-_]*\d*$/i,         // "Host" (generic meeting host)
    /^meeting\s+speaker/i,        // "Meeting Speaker"
    /^unknown/i,                  // "Unknown", "Unknown Speaker"
    /^unidentified/i,             // "Unidentified"
    /^anonymous/i,                // "Anonymous"
    /^\d+$/,                      // Just numbers
    /^[A-Z]$/,                    // Single letters
    /^me$/i,                      // "Me"
    /^you$/i,                     // "You"
    /^other$/i,                   // "Other"
  ];
  
  for (const pattern of genericPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  // Must contain at least some alphabetic characters (not just numbers/symbols)
  const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < 2) return false;
  
  return true;
}

function getBaseUrl(_req: Request): string { return publicOrigin(); }

async function getUserFromOmiUid(omiUid: string): Promise<{ id: string; targetLanguage: string }> {
  if (!process.env.OMI_UID || omiUid !== process.env.OMI_UID) throw new Error("Account mismatch");
  const user = await operatorUser();
  return { id: user.id, targetLanguage: user.targetLanguage || "Spanish" };
}

/**
 * Extract user facts from Omi memory structured data
 */
function extractFactsFromMemory(memory: any): Array<{ category: string; content: string }> {
  const facts: Array<{ category: string; content: string }> = [];

  if (!memory) return facts;

  // Extract from structured field
  const structured = memory.structured;
  if (structured) {
    // Title usually contains a concise fact
    if (structured.title && structured.title.length > 10) {
      facts.push({
        category: structured.category || structured.emoji || 'general',
        content: structured.title,
      });
    }

    // Overview contains more detailed information
    if (structured.overview && structured.overview.length > 20 && structured.overview !== structured.title) {
      facts.push({
        category: structured.category || structured.emoji || 'general',
        content: structured.overview,
      });
    }

    // Action items might be useful
    if (structured.action_items && Array.isArray(structured.action_items)) {
      for (const item of structured.action_items) {
        if (typeof item === 'string' && item.length > 10) {
          facts.push({
            category: 'action',
            content: item,
          });
        }
      }
    }
  }

  // Extract from geolocation context
  if (memory.geolocation?.address && memory.geolocation.address.length > 5) {
    facts.push({
      category: 'location',
      content: `User was at ${memory.geolocation.address}`,
    });
  }

  // Extract from transcript if structured is empty
  if (facts.length === 0 && memory.transcript_segments && Array.isArray(memory.transcript_segments)) {
    const userText = memory.transcript_segments
      .filter((seg: any) => seg.is_user)
      .map((seg: any) => seg.text)
      .join(' ')
      .trim();

    if (userText.length > 30) {
      // Use the conversation as a fact if it's substantial
      facts.push({
        category: 'conversation',
        content: userText.slice(0, 500), // Limit length
      });
    }
  }

  return facts;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await installSecurity(app);

  
  // ============================================
  // OMI INTEGRATION ENDPOINTS
  // ============================================

  // Chat Tools Manifest - Required for Omi App Store
  // Format: https://docs.omi.me/doc/developer/apps/ChatTools
  app.get("/.well-known/omi-tools.json", trackHandler((_req, res) => {
    res.json({ tools: [], description: "Public Omi tools are disabled. See README for authenticated relay setup." });
  }));

  // Setup Complete Callback - Called by Omi when user installs the app
  // GET endpoint returning {"is_setup_completed": boolean}
  app.get("/api/omi/setup-complete", trackHandler(async (req: Request, res: Response) => {
    try {
      const uid = req.query.uid as string;
      
      if (uid) {
        // Check if this UID has a connection
        const connection = await storage.getOmiConnectionByUid(uid);
        res.json({ is_setup_completed: !!connection });
      } else {
        res.json({ is_setup_completed: false });
      }
    } catch (error) {
      /* Private payloads are not logged. */
      res.json({ is_setup_completed: false });
    }
  }));

  // POST version for explicit setup completion notification
  app.post("/api/omi/setup-complete", trackHandler(async (req: Request, res: Response) => {
    try {
      const uid = (req.query.uid as string) || req.body?.uid;
      
      if (!uid) {
        return res.status(400).json({ status: "error", message: "Missing uid" });
      }
      
      /* Private payloads are not logged. */

      // Get or create user from Omi UID
      const user = await getUserFromOmiUid(uid);

      // Store the Omi connection
      await storage.createOmiConnection({
        omiUid: uid,
        userId: user.id,
        appId: req.body?.app_id,
        status: "connected"
      });

      /* Private payloads are not logged. */

      res.json({ status: "ok" });
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ status: "error" });
    }
  }));

  // Real-time Transcript Webhook
  // Omi sends: POST /endpoint?session_id=abc123&uid=user123
  // Body: Array of transcript segments
  app.post("/api/omi/webhook/transcript", trackHandler(async (req: Request, res: Response) => {
    try {
      const session_id = req.query.session_id as string;
      const uid = req.query.uid as string;
      const segments = req.body; // Array of segments directly in body

      if (!uid) {
        return res.status(400).json({ status: "error", message: "Missing uid parameter" });
      }

      /* Private payloads are not logged. */

      // Get or create user from Omi UID
      const user = await getUserFromOmiUid(uid);
      const userId = user.id;

      if (Array.isArray(segments) && segments.length > 0) {
        // Filter for user speech only
        const userSegments = segments.filter((seg: { is_user?: boolean }) => seg.is_user === true);

        for (const segment of userSegments) {
          if (segment.text && segment.text.length > 15) {
            try {
              const analysis = await analyzeTextWithGemini(segment.text);

              if (analysis.hasIssues && analysis.original && analysis.corrected) {
                // Create learning item from mistake
                const item = await storage.createLearningItem({
                  userId,
                  sessionId: session_id,
                  originalText: analysis.original,
                  correctedText: analysis.corrected,
                  explanation: analysis.explanation || "Language correction",
                  category: analysis.category || "grammar",
                });

                // Create a challenge for this item
                await storage.createDailyChallenge({
                  userId,
                  learningItemId: item.id,
                  challengeText: `Practice: ${analysis.corrected}`,
                  xpEarned: 25,
                });

                /* Private payloads are not logged. */
              }
            } catch (analysisError) {
              /* Private payloads are not logged. */
            }
          }
        }
      }

      res.json({ status: "ok" });
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ status: "error" });
    }
  }));

  // Memory Trigger Webhook - Called when a conversation ends
  // Omi sends: POST /endpoint?uid=user123
  // Body: Memory object with id, transcript_segments, structured, etc.
  app.post("/api/omi/webhook/memory", trackHandler(async (req: Request, res: Response) => {
    try {
      const uid = req.query.uid as string;
      const memory = req.body;

      if (!uid) {
        return res.status(400).json({ status: "error", message: "Missing uid parameter" });
      }

      /* Private payloads are not logged. */

      // Get or create user from Omi UID
      const user = await getUserFromOmiUid(uid);
      const userId = user.id;

      /* Private payloads are not logged. */

      // Extract and store user facts from structured data
      const facts = extractFactsFromMemory(memory);
      if (facts.length > 0) {
        /* Private payloads are not logged. */
        for (const fact of facts) {
          try {
            await storage.createUserFact({
              userId,
              omiFactId: memory?.id,
              category: fact.category,
              content: fact.content,
            });
            /* Private payloads are not logged. */
          } catch (error) {
            /* Private payloads are not logged. */
          }
        }
      }

      // Process transcript segments for learning items
      const segments = memory?.transcript_segments;
      if (Array.isArray(segments) && segments.length > 0) {
        // Combine all user segments into a transcript
        const userText = segments
          .filter((seg: { is_user?: boolean }) => seg.is_user === true)
          .map((seg: { text: string }) => seg.text)
          .join(' ');

        if (userText.length > 20) {
          // Get user's target language for context
          const userProfile = await storage.getUser(userId);
          const targetLanguage = userProfile?.targetLanguage || "Spanish";

          const conversationContext = {
            title: memory?.structured?.title,
            category: memory?.structured?.category,
            targetLanguage,
          };

          const analysis = await analyzeConversationWithGemini(userText, undefined, conversationContext);

          // Only create learning items if this was language practice
          if (analysis.isLanguagePractice && analysis.issues && analysis.issues.length > 0) {
            /* Private payloads are not logged. */
            for (const issue of analysis.issues) {
              await storage.createLearningItem({
                userId,
                sessionId: memory?.id,
                originalText: issue.original,
                correctedText: issue.corrected,
                explanation: issue.explanation,
                category: issue.category || "grammar",
              });
            }
          }
        }
      }

      res.json({ status: "ok" });
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ status: "error" });
    }
  }));

  // Real-time Audio Bytes Webhook
  // Omi sends: POST /endpoint?sample_rate=16000&uid=user123
  // Body: Raw PCM16 audio bytes (application/octet-stream)
  app.post("/api/omi/webhook/audio", trackHandler(async (req, res) => {
    try { await ingestAudio(req, res); }
    catch { res.status(500).json({ error: "Audio upload failed" }); }
  }));

  // Trigger audio compilation and analysis for a session
  app.post("/api/omi/compile-session/:sessionId", trackHandler(async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const uid = await getUserIdFromRequest(req);
      const omiUid = process.env.OMI_UID;
      if (!omiUid) return res.status(503).json({ error: "Audio requires configured OMI_UID" });

      // Get all audio chunks for this session
      const chunks = (await storage.getAudioChunks(sessionId)).filter(c => c.userId === uid);
      if (chunks.length > 8) return res.status(413).json({ error: "Compile at most 8 audio chunks" });
      if (chunks.length === 0) {
        return res.status(404).json({ error: "No audio chunks found for session" });
      }

      // Get transcript segments for this session
      const segments = (await storage.getTranscriptSegments(sessionId)).filter(s => s.userId === uid);
      const transcriptText = segments
        .filter(s => s.isUser)
        .map(s => s.text)
        .join(' ');

      /* Private payloads are not logged. */

      // Create audio analysis record
      const analysis = await storage.createAudioAnalysis({
        sessionId,
        userId: uid,
        transcriptText: transcriptText || null,
        status: "processing",
      });

      let compiledAudioUri: string | null = null;
      let analysisResult: any = null;
      let overallScore: number | null = null;
      let pronunciationScore: number | null = null;
      let fluencyScore: number | null = null;
      let accuracyScore: number | null = null;

      // Compile audio if GCP is configured
      if (gcpStorage.isConfigured() && chunks.length > 0) {
        try {
          // Download and concatenate all audio chunks
          const audioBuffers: Buffer[] = [];
          for (const chunk of chunks.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0))) {
            const buffer = await gcpStorage.downloadAudioChunk(chunk.gcpUri);
            audioBuffers.push(buffer);
          }
          
          // Concatenate raw PCM audio
          const compiledPcm = Buffer.concat(audioBuffers);
          if (compiledPcm.length + 44 > 6 * 1024 * 1024) throw new Error("Compiled session exceeds audio object limit");
          const sampleRate = chunks[0]?.sampleRate || 16000;
          
          // Upload compiled audio with proper WAV header
          const startTime = chunks[0]?.createdAt || new Date();
          const endTime = chunks[chunks.length - 1]?.createdAt || new Date();
          const result = await gcpStorage.uploadCompiledWav(omiUid, compiledPcm, sampleRate, startTime, endTime);
          compiledAudioUri = result.gcpUri;
          await storage.createCompiledAudioFile({
            userId: uid, gcpUri: result.gcpUri, startTimestamp: startTime, endTimestamp: endTime,
            sampleRate, fileSize: result.fileSize, durationMs: Math.round(compiledPcm.length / 2 / sampleRate * 1000),
          });
          /* Private payloads are not logged. */

          // Update analysis with compiled audio URI
          await storage.updateAudioAnalysis(analysis.id, {
            compiledAudioUri,
          });
        } catch (audioError) {
          /* Private payloads are not logged. */
          // Continue with text-based analysis even if audio compilation fails
        }
      }

      // Perform text-based analysis with Gemini
      if (transcriptText && transcriptText.length > 20) {
        // Manual compilation assumes language practice session
        const userProfile = await storage.getUser(uid);
        const targetLanguage = userProfile?.targetLanguage || "Spanish";

        const conversationContext = {
          title: "Manual Session Compilation",
          category: "practice",
          targetLanguage,
        };

        const geminiAnalysis = await analyzeConversationWithGemini(
          transcriptText,
          compiledAudioUri ? [compiledAudioUri] : undefined,
          conversationContext
        );
        analysisResult = geminiAnalysis;

        // Calculate scores based on analysis results
        const issueCount = geminiAnalysis.issues?.length || 0;
        const wordCount = transcriptText.split(/\s+/).length;

        // Score calculation: fewer issues = higher score
        const issueRatio = Math.min(issueCount / Math.max(wordCount / 10, 1), 1);
        overallScore = Math.round(100 - (issueRatio * 50));
        fluencyScore = Math.round(90 - (issueCount * 5));
        accuracyScore = overallScore;

        // Count pronunciation issues for pronunciation score
        const pronunciationIssues = geminiAnalysis.issues?.filter((i: any) => i.category === "pronunciation").length || 0;
        pronunciationScore = compiledAudioUri ? Math.max(0, Math.round(100 - (pronunciationIssues * 15))) : null;

        // Generate lessons from issues found (manual compilation always creates items)
        for (const issue of geminiAnalysis.issues || []) {
          await storage.createLearningItem({
            userId: uid,
            sessionId,
            originalText: issue.original,
            correctedText: issue.corrected,
            explanation: issue.explanation,
            category: issue.category || "grammar",
          });

          // Create a pronunciation lesson if applicable
          if (issue.category === "pronunciation") {
            await storage.createLesson({
              userId: uid,
              sessionId,
              analysisId: analysis.id,
              lessonType: "pronunciation",
              title: `Pronunciation Practice: ${issue.corrected}`,
              content: `Practice saying: "${issue.corrected}"\n\nYour version: "${issue.original}"\n\nTip: ${issue.explanation}`,
              audioReferences: compiledAudioUri,
              difficulty: "intermediate",
              xpReward: 50,
            });
          }
        }
      }

      // Always finalize the analysis record
      await storage.updateAudioAnalysis(analysis.id, {
        status: "completed",
        analysisJson: analysisResult ? JSON.stringify(analysisResult) : null,
        overallScore,
        pronunciationScore,
        fluencyScore,
        accuracyScore,
        completedAt: new Date(),
      });

      res.json({ 
        status: "ok", 
        analysisId: analysis.id,
        chunksProcessed: chunks.length,
        segmentsProcessed: segments.length,
        compiledAudioUri,
        scores: { overall: overallScore, pronunciation: pronunciationScore, fluency: fluencyScore, accuracy: accuracyScore }
      });
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to compile session" });
    }
  }));

  // Get audio analysis status
  app.get("/api/audio-analysis/:sessionId", trackHandler(async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const analysis = await storage.getAudioAnalysis(sessionId);
      
      if (!analysis || analysis.userId !== requestUserId(req)) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      res.json(analysis);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch analysis" });
    }
  }));

  // Get lessons for user
  app.get("/api/lessons", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const lessons = await storage.getLessons(userId);
      res.json(lessons);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch lessons" });
    }
  }));

  // Complete a lesson
  app.patch("/api/lessons/:id/complete", trackHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const owned = await storage.getLesson(id);
      if (!owned || owned.userId !== requestUserId(req)) return res.status(404).json({ error: "Lesson not found" });
      if (owned.completed) return res.json(owned);
      const lesson = await storage.completeLesson(id);
      
      if (!lesson) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      // Award XP
      const userId = await getUserIdFromRequest(req);
      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUserStats(userId, {
          totalXp: (user.totalXp || 0) + (lesson.xpReward || 50),
        });
      }

      res.json(lesson);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to complete lesson" });
    }
  }));

  // Get GCP status
  app.get("/api/gcp/status", trackHandler(async (req: Request, res: Response) => {
    try {
      const configured = gcpStorage.isConfigured();
      let connected = false;

      if (configured) {
        connected = await gcpStorage.testConnection();
      }

      // Get folder ID for current user if available
      let folderId: string | undefined;
      let omiUid: string | undefined;
      try {
        const userId = await getUserIdFromRequest(req);
        const user = await storage.getUser(userId);
        if (user?.omiUid) {
          omiUid = user.omiUid;
          folderId = gcpStorage.generateFolderIdFromOmiUid(user.omiUid);
        }
      } catch {}

      res.json({
        configured,
        connected,
        folderId,
        omiUid: omiUid ? `${omiUid.substring(0, 8)}...` : undefined, // Partially obscured for privacy
        folderPath: folderId ? `gs://${process.env.GCP_BUCKET_NAME}/${folderId}/` : undefined
      });
    } catch (error) {
      res.json({ configured: false, connected: false, error: "Provider operation failed" });
    }
  }));

  // ============================================
  // OMI CHAT TOOLS (Called by Omi when user invokes tools)
  // Return format: { result: string } or { error: string }
  // ============================================

  // Analyze speech tool
  app.post("/api/omi/tools/analyze", trackHandler(async (req: Request, res: Response) => {
    try {
      const { text, target_language } = req.body;
      
      if (!text) {
        return res.json({ error: "Please provide some text to analyze" });
      }

      const analysis = await analyzeTextWithGemini(text, target_language);

      if (analysis.hasIssues) {
        // Save to learning queue
        const userId = await getUserIdFromRequest(req);
        await storage.createLearningItem({
          userId,
          originalText: analysis.original!,
          correctedText: analysis.corrected!,
          explanation: analysis.explanation || "Language correction",
          category: analysis.category || "grammar",
        });

        res.json({
          result: `Found an issue!\n\nYou said: "${analysis.original}"\n\nBetter way: "${analysis.corrected}"\n\nExplanation: ${analysis.explanation}\n\nI've added this to your learning queue for practice!`
        });
      } else {
        res.json({
          result: `Great job! "${text}" sounds correct. Keep up the good work!`
        });
      }
    } catch (error) {
      /* Private payloads are not logged. */
      res.json({ error: "Sorry, I couldn't analyze that right now. Try again?" });
    }
  }));

  // Get learning status tool
  app.post("/api/omi/tools/status", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const stats = await storage.getOverviewStats(userId);
      const user = await storage.getUser(userId);

      const result = `Here's your LinguaFlow status:\n\n` +
        `Streak: ${stats.streak} days\n` +
        `Level: ${user?.level || 1}\n` +
        `Total XP: ${user?.totalXp || 0}\n` +
        `Today's Progress: ${stats.todayCompleted}/${stats.todayTotal} challenges\n` +
        `Learning Items: ${stats.totalItems} in queue\n\n` +
        `Keep practicing to maintain your streak!`;

      res.json({ result });
    } catch (error) {
      /* Private payloads are not logged. */
      res.json({ error: "Couldn't fetch your status right now" });
    }
  }));

  // Add to learning queue tool
  app.post("/api/omi/tools/add-item", trackHandler(async (req: Request, res: Response) => {
    try {
      const { original_text, corrected_text, explanation, category } = req.body;

      if (!original_text || !corrected_text) {
        return res.json({ error: "Please provide both the original and corrected text" });
      }

      const userId = await getUserIdFromRequest(req);
      await storage.createLearningItem({
        userId,
        originalText: original_text,
        correctedText: corrected_text,
        explanation: explanation || "Custom learning item",
        category: category || "vocabulary",
      });

      res.json({
        result: `Added to your learning queue!\n\n"${original_text}" -> "${corrected_text}"\n\nI'll remind you to practice this using spaced repetition.`
      });
    } catch (error) {
      /* Private payloads are not logged. */
      res.json({ error: "Couldn't add to your queue right now" });
    }
  }));

  // Get daily challenges tool
  app.post("/api/omi/tools/challenges", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const challenges = await storage.getDailyChallenges(userId);
      const pending = challenges.filter(c => !c.completed);

      if (pending.length === 0) {
        res.json({
          result: "Amazing! You've completed all of today's challenges. Check back tomorrow for more practice!"
        });
      } else {
        const items = await Promise.all(
          pending.slice(0, 3).map(async (c) => {
            if (c.learningItemId) {
              const item = await storage.getLearningItem(c.learningItemId);
              if (item) {
                return `- "${item.originalText}" -> "${item.correctedText}"`;
              }
            }
            return `- ${c.challengeText}`;
          })
        );

        res.json({
          result: `You have ${pending.length} challenges to complete today!\n\nHere are some to work on:\n${items.join('\n')}\n\nOpen LinguaFlow to practice!`
        });
      }
    } catch (error) {
      /* Private payloads are not logged. */
      res.json({ error: "Couldn't fetch your challenges right now" });
    }
  }));

  // ============================================
  // UNIFIED OMI HUB ENDPOINT
  // ============================================
  // Single URL that handles all Omi callbacks via query parameter routing
  // Use: /api/omi/hub?event=transcript|audio|memory|setup_complete

  // GET handler for setup_complete check and app home
  app.get("/api/omi/hub", trackHandler(async (req: Request, res: Response) => {
    const event = req.query.event as string;
    const uid = req.query.uid as string;

    // Handle setup_complete check (returns is_setup_completed boolean)
    if (event === "setup_complete") {
      try {
        if (uid) {
          const connection = await storage.getOmiConnectionByUid(uid);
          return res.json({ is_setup_completed: !!connection });
        }
        return res.json({ is_setup_completed: false });
      } catch (error) {
        /* Private payloads are not logged. */
        return res.json({ is_setup_completed: false });
      }
    }

    // Default: redirect to app home (dashboard)
    const baseUrl = getBaseUrl(req);
    res.redirect(`${baseUrl}/dashboard`);
  }));

  // POST handler for webhooks and setup_complete notification
  // Auto-detects event type from payload if not specified in query
  app.post("/api/omi/hub", trackHandler(async (req: Request, res: Response) => {
    let event = req.query.event as string;
    const uid = req.query.uid as string;
    const session_id = req.query.session_id as string;
    const contentType = req.headers['content-type'] || '';
    const sampleRate = req.query.sample_rate as string;

    // Log all incoming webhook requests for debugging
    /* Private payloads are not logged. */

    // Auto-detect event type from payload structure if not specified
    if (!event) {
      const body = req.body;

      // Check content type for audio (binary data)
      if (contentType.includes('octet-stream') || contentType.includes('audio')) {
        event = 'audio';
      }
      // Check for memory structure (has transcript_segments and structured fields)
      else if (body?.transcript_segments && (body?.structured || body?.id)) {
        event = 'memory';
      }
      // Check for transcript array (array of segments with text/is_user fields)
      else if (Array.isArray(body) && body.length > 0 && body[0]?.text !== undefined) {
        event = 'transcript';
      }
      // Check for setup complete notification
      else if (body?.app_id || (body?.uid && Object.keys(body).length <= 2)) {
        event = 'setup_complete';
      }
      // Default fallback
      else {
        /* Private payloads are not logged. */
        event = 'unknown';
      }
    }

    /* Private payloads are not logged. */

    try {
      switch (event) {
        case "transcript": {
          // Handle real-time transcript
          const segments = req.body;

          if (!uid) {
            return res.status(400).json({ status: "error", message: "Missing uid parameter" });
          }

          const user = await getUserFromOmiUid(uid);
          const userId = user.id;
          const targetLanguage = user.targetLanguage;

          /* Private payloads are not logged. */

          if (Array.isArray(segments) && segments.length > 0) {
            const userSegments = segments.filter((seg: { is_user?: boolean }) => seg.is_user === true);

            // Store segments first
            for (const segment of userSegments) {
              await storage.createTranscriptSegment({
                sessionId: session_id || `session-${Date.now()}`,
                userId,
                text: segment.text,
                speaker: segment.speaker,
                speakerId: segment.speaker_id,
                isUser: true,
                startMs: segment.start,
                endMs: segment.end,
              });
            }

            // Analyze all user speech for language learning (no trigger phrase restrictions)
            for (const segment of userSegments) {
              if (segment.text && segment.text.length > 15) {
                try {
                  const analysis = await analyzeTextWithGemini(segment.text);
                  if (analysis.hasIssues && analysis.original && analysis.corrected) {
                    await storage.createLearningItem({
                      userId,
                      sessionId: session_id,
                      originalText: analysis.original,
                      correctedText: analysis.corrected,
                      explanation: analysis.explanation || "Language correction",
                      category: analysis.category || "grammar",
                    });
                  }
                } catch (analysisError) {
                  /* Private payloads are not logged. */
                }
              }
            }
          }
          return res.json({ status: "ok" });
        }

        case "audio": {
          return await ingestAudio(req, res);
        }

        case "memory": {
          // Handle memory trigger (conversation end)
          const memory = req.body;
          const segments = memory?.transcript_segments;

          if (!uid) {
            return res.status(400).json({ status: "error", message: "Missing uid parameter" });
          }

          const user = await getUserFromOmiUid(uid);
          const userId = user.id;

          /* Private payloads are not logged. */

          // Extract and store user facts from structured data
          const facts = extractFactsFromMemory(memory);
          if (facts.length > 0) {
            /* Private payloads are not logged. */
            for (const fact of facts) {
              try {
                await storage.createUserFact({
                  userId,
                  omiFactId: memory?.id,
                  category: fact.category,
                  content: fact.content,
                });
                /* Private payloads are not logged. */
              } catch (error) {
                /* Private payloads are not logged. */
              }
            }
          }

          if (Array.isArray(segments) && segments.length > 0) {
            // Check for active voice challenge first
            const activeChallenge = await storage.getActiveVoiceChallenge(userId);

            if (activeChallenge) {
              // Collect user's speech as challenge response
              // Note: Omi memory events may not always have is_user field set,
              // so we take all segments if is_user is not defined
              const userSpeech = segments
                .filter((seg: { is_user?: boolean }) => seg.is_user === true || seg.is_user === undefined)
                .map((seg: { text: string }) => seg.text)
                .join(' ');

              if (userSpeech.length > 30) {
                /* Private payloads are not logged. */

                try {
                  const { analyzeChallengeResponse } = await import("./gemini-challenge");

                  // Find audio files for this response
                  // Estimate response time: from now - (speech duration) to now
                  // Speech duration ≈ 3 words per second (rough estimate)
                  const wordCount = userSpeech.split(/\s+/).length;
                  const estimatedDurationMs = (wordCount / 3) * 1000;
                  const responseEndTime = new Date();
                  const responseStartTime = new Date(responseEndTime.getTime() - Math.max(estimatedDurationMs, 60000)); // At least 60s back

                  let audioUris: string[] = [];
                  if (gcpStorage.isConfigured()) {
                    try {
                      audioUris = await gcpStorage.getCompiledAudioInTimeRange(
                        uid, // Use Omi UID for consistent folder lookup
                        responseStartTime,
                        responseEndTime
                      );
                      /* Private payloads are not logged. */
                    } catch (audioError) {
                      /* Private payloads are not logged. */
                    }
                  }

                  // Analyze with both transcript and audio
                  const feedback = await analyzeChallengeResponse(
                    activeChallenge,
                    userSpeech,
                    audioUris.length > 0 ? audioUris : undefined
                  );

                  // Update challenge with response and feedback
                  const updatedChallenge = await storage.updateVoiceChallenge(activeChallenge.id, {
                    responseTranscript: userSpeech,
                    respondedAt: new Date(),
                    feedbackJson: JSON.stringify(feedback),
                    grammarScore: feedback.grammarScore,
                    vocabularyScore: feedback.vocabularyScore,
                    pronunciationScore: feedback.pronunciationScore,
                    overallScore: feedback.overallScore,
                    corrections: JSON.stringify(feedback.corrections),
                    xpEarned: Math.round(feedback.overallScore * 1.5),
                    status: 'completed',
                    completedAt: new Date()
                  });

                  /* Private payloads are not logged. */

                  // Skip normal analysis for this memory since it was a challenge response
                  return res.json({ status: "ok", challenge_completed: true, xp_earned: updatedChallenge?.xpEarned || 0 });
                } catch (error) {
                  /* Private payloads are not logged. */
                }
              }
            }
            
            // Get all user speech for analysis
            const userText = segments
              .filter((seg: { is_user?: boolean }) => seg.is_user === true)
              .map((seg: { text: string }) => seg.text)
              .join(' ');

            if (userText.length > 20) {
              /* Private payloads are not logged. */

              // Calculate time range from all segments
              const segmentTimes = segments
                .filter((seg: { start?: number; end?: number }) => seg.start !== undefined && seg.end !== undefined)
                .map((seg: { start: number; end: number }) => ({ start: seg.start, end: seg.end }));

              let audioUris: string[] | undefined;

              if (segmentTimes.length > 0) {
                const minStart = Math.min(...segmentTimes.map(t => t.start));
                const maxEnd = Math.max(...segmentTimes.map(t => t.end));

                // Convert relative ms to actual timestamps (approximate)
                // Assuming the memory was created at the end of the conversation
                const now = new Date();
                const conversationDuration = maxEnd; // ms from start
                const startTime = new Date(now.getTime() - conversationDuration);
                const endTime = now;

                // Find audio files with overlapping timestamps
                const matchingAudioFiles = await storage.getCompiledAudioFilesInRange(
                  userId,
                  startTime,
                  endTime
                );

                /* Private payloads are not logged. */

                if (matchingAudioFiles.length > 0) {
                  audioUris = matchingAudioFiles.map(f => f.gcpUri);
                  /* Private payloads are not logged. */
                }
              }

              // Get user's target language for context
              const userProfile = await storage.getUser(userId);
              const targetLanguage = userProfile?.targetLanguage || "Spanish";

              // Pass memory structured data for additional context
              const conversationContext = {
                title: memory?.structured?.title,
                category: memory?.structured?.category,
                targetLanguage,
              };

              const analysis = await analyzeConversationWithGemini(
                userText,
                audioUris,
                conversationContext
              );

              // Only create learning items if Gemini determined this was language practice
              if (analysis.isLanguagePractice && analysis.issues && analysis.issues.length > 0) {
                /* Private payloads are not logged. */

                for (const issue of analysis.issues) {
                  await storage.createLearningItem({
                    userId,
                    sessionId: memory?.id,
                    originalText: issue.original,
                    correctedText: issue.corrected,
                    explanation: issue.explanation,
                    category: issue.category || "grammar",
                  });
                }
              } else if (!analysis.isLanguagePractice) {
                /* Private payloads are not logged. */
              } else {
                /* Private payloads are not logged. */
              }
            }
          }
          return res.json({ status: "ok" });
        }

        case "setup_complete": {
          // Handle setup completion notification
          const omiUid = uid || req.body?.uid;
          if (!omiUid) {
            return res.status(400).json({ status: "error", message: "Missing uid" });
          }

          // Get or create user from Omi UID
          const user = await getUserFromOmiUid(omiUid);

          await storage.createOmiConnection({
            omiUid,
            userId: user.id,
            appId: req.body?.app_id,
            status: "connected"
          });

          /* Private payloads are not logged. */

          return res.json({ status: "ok" });
        }

        case "unknown":
        default:
          // Unknown or undetected event type - still respond OK
          /* Private payloads are not logged. */
          return res.json({ status: "ok", message: "Event processed" });
      }
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ status: "error" });
    }
  }));

  // ============================================
  // SETUP & STATUS ENDPOINTS
  // ============================================

  // Get Omi setup info for the settings page
  app.get("/api/omi/setup-info", trackHandler((_req, res) => res.json({
    hub_url: `${publicOrigin()}/api/omi/hub`,
    enabled: !!process.env.OMI_WEBHOOK_SECRET && !!process.env.OMI_UID,
    instructions: ["Requires a trusted relay that authenticates Omi upstream delivery.", "Relay sends Bearer OMI_WEBHOOK_SECRET, configured uid, X-Event-Id and X-Event-Timestamp (epoch milliseconds).", "Direct Omi custom-header support has not been verified. Leave ingestion disabled without a verified relay."],
  })));

  // Check Omi connection status
  app.get("/api/omi/status", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const connection = await storage.getOmiConnection(userId);
      res.json({
        connected: !!connection,
        connection: connection || null
      });
    } catch (error) {
      res.json({ connected: false, connection: null });
    }
  }));

  // Test endpoint for webhook debugging
  // ============================================
  // AUTH & USER ENDPOINTS
  // ============================================

  app.post("/api/auth/login-omi", trackHandler((_req, res) => res.status(410).json({ error: "Use operator sign-in" })));
  app.get("/api/users", trackHandler((_req, res) => res.status(404).json({ error: "Not available" })));
  app.get("/api/users/current", trackHandler(async (req, res) => res.json(publicUser((await storage.getUser(requestUserId(req)))!))));
  app.get("/api/user/profile", trackHandler(async (req, res) => res.json(publicUser((await storage.getUser(requestUserId(req)))!))));

  // Update user preferences
  app.patch("/api/user/preferences", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const { demoDataEnabled, nativeLanguage, targetLanguage } = req.body;
      if ((demoDataEnabled !== undefined && typeof demoDataEnabled !== "boolean") || [nativeLanguage, targetLanguage].some(v => v !== undefined && (typeof v !== "string" || !v.trim() || v.length > 80))) return res.status(400).json({ error: "Invalid preferences" });

      
      const user = await storage.updateUserPreferences(userId, {
        demoDataEnabled,
        nativeLanguage,
        targetLanguage
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ success: true, user: publicUser(user) });
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to update preferences" });
    }
  }));

  // Reset all user data
  app.post("/api/user/reset", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      
      audioPool.clear();
      await storage.resetUserData(userId);
      
      const user = await storage.getUser(userId);
      res.json({ 
        success: true, 
        message: "Local learning data reset. Cloud recordings must be deleted separately.",
        user: user ? {
          id: user.id,
          streak: user.streak,
          totalXp: user.totalXp,
          level: user.level
        } : null
      });
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to reset data" });
    }
  }));

  // ============================================
  // CHALLENGE CHAT ENDPOINTS
  // ============================================

  // Get chat messages
  app.get("/api/chat/messages", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const challengeId = req.query.challengeId ? parseInt(req.query.challengeId as string) : undefined;
      
      const messages = await storage.getChatMessages(userId, challengeId);
      res.json(messages);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  }));

  // Send chat message and get Gemini response
  app.post("/api/chat/send", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const { message, challengeId } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      // Save user message
      await storage.createChatMessage({
        userId,
        challengeId: challengeId || null,
        role: "user",
        content: message
      });

      // Get context: active challenge and recent transcripts
      let contextPrompt = "";
      const activeChallenge = await storage.getActiveVoiceChallenge(userId);
      
      if (activeChallenge) {
        contextPrompt += `\n\nCurrent Voice Challenge:\nPrompt: "${activeChallenge.prompt}"\nLanguage Goal: ${activeChallenge.languageGoal || 'general practice'}\nTarget Language: ${activeChallenge.targetLanguage || 'Spanish'}\n`;
        
        if (activeChallenge.responseTranscript) {
          contextPrompt += `User's Response: "${activeChallenge.responseTranscript}"\n`;
        }
        
        if (activeChallenge.feedbackJson) {
          try {
            const feedback = JSON.parse(activeChallenge.feedbackJson);
            contextPrompt += `Feedback Summary: ${feedback.summary || 'No summary available'}\n`;
          } catch {}
        }
      }

      // Call Gemini for response
      const systemPrompt = `You are a helpful language learning assistant for LinguaFlow. 
Help users understand their speaking challenges, explain grammar concepts, and provide tips for improvement.
Be encouraging and supportive. Keep responses concise but informative.
${contextPrompt}`;

      if (!ai) throw new Error("Gemini is not configured");
    const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: "user", parts: [{ text: systemPrompt + "\n\nUser: " + message }] }
        ]
      });

      const assistantMessage = response.text || "I'm here to help with your language learning!";

      // Save assistant response
      const savedMessage = await storage.createChatMessage({
        userId,
        challengeId: challengeId || null,
        role: "assistant",
        content: assistantMessage,
        contextJson: activeChallenge ? JSON.stringify({ challengeId: activeChallenge.id }) : null
      });

      res.json({ 
        success: true, 
        message: savedMessage,
        activeChallenge: activeChallenge ? {
          id: activeChallenge.id,
          prompt: activeChallenge.prompt,
          status: activeChallenge.status
        } : null
      });
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to send message" });
    }
  }));

  // Clear chat history
  app.delete("/api/chat/clear", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      await storage.clearChatMessages(userId);
      res.json({ success: true });
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to clear chat" });
    }
  }));

  // ============================================
  // EXISTING APP ENDPOINTS
  // ============================================

  app.get("/api/stats/overview", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const stats = await storage.getOverviewStats(userId);
      res.json(stats);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  }));

  app.get("/api/stats/weekly", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const stats = await storage.getWeeklyStats(userId);
      res.json(stats);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch weekly stats" });
    }
  }));

  app.get("/api/stats/progress", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const stats = await storage.getProgressStats(userId);
      res.json(stats);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch progress stats" });
    }
  }));

  app.get("/api/challenges/today", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const challenges = await storage.getDailyChallenges(userId);
      res.json(challenges);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  }));

  app.patch("/api/challenges/:id/complete", trackHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { quality } = req.body;
      
      const owned = await storage.getDailyChallenge(id);
      if (!owned || owned.userId !== requestUserId(req)) return res.status(404).json({ error: "Challenge not found" });
      if (owned.completed) return res.json(owned);
      if (!Number.isInteger(quality) || quality < 0 || quality > 5) return res.status(400).json({ error: "Quality must be 0–5" });
      const challenge = await storage.completeChallenge(id, quality);
      if (!challenge || challenge.userId !== requestUserId(req)) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const userId = await getUserIdFromRequest(req);
      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUserStats(userId, {
          totalXp: (user.totalXp || 0) + (challenge.xpEarned || 25),
        });
      }

      res.json(challenge);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to complete challenge" });
    }
  }));

  app.get("/api/learning-items", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const items = await storage.getLearningItems(userId);
      res.json(items);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch learning items" });
    }
  }));

  app.post("/api/learning-items", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const item = await storage.createLearningItem({
        ...req.body,
        userId,
      });
      res.status(201).json(item);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to create learning item" });
    }
  }));

  app.get("/api/achievements", trackHandler(async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      const achievements = await storage.getAchievements(userId);
      res.json(achievements);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to fetch achievements" });
    }
  }));

  app.post("/api/analyze-text", trackHandler(async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const analysis = await analyzeTextWithGemini(text);
      res.json(analysis);
    } catch (error) {
      /* Private payloads are not logged. */
      res.status(500).json({ error: "Failed to analyze text" });
    }
  }));

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

  return httpServer;
}

async function analyzeTextWithGemini(text: string, targetLanguage?: string, nativeLanguage?: string): Promise<{
  hasIssues: boolean;
  original?: string;
  corrected?: string;
  explanation?: string;
  category?: string;
}> {
  try {
    const lang = targetLanguage || "Spanish";
    const native = nativeLanguage || "English";
    const prompt = `You are a native ${lang} speaker helping a ${native} speaker learn ${lang}.

Analyze this ${lang} text: "${text}"

Focus on IDIOMATIC NATURALNESS:
- Does this sound like a native speaker or like a textbook/translation?
- Are there more natural, idiomatic ways to express this?
- Is the phrasing culturally appropriate?

If there are issues or better idiomatic alternatives, respond with:
{
  "hasIssues": true,
  "original": "the phrase that could be more natural",
  "corrected": "the idiomatic native way to say it",
  "explanation": "why natives say it this way (1-2 sentences)",
  "category": "idiomatic" or "grammar" or "vocabulary"
}

If the text sounds natural and idiomatic, respond with: {"hasIssues": false}

Prioritize naturalness over correctness. Textbook-correct but unnatural phrases should be flagged.

Respond ONLY with valid JSON, no other text or markdown.`;

    if (!ai) throw new Error("Gemini is not configured");
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const responseText = response.text || '{"hasIssues": false}';
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error("Text analysis unavailable");
  } catch (error) {
    /* Private payloads are not logged. */
    throw new Error("Text analysis unavailable");
  }
}

export async function analyzeConversationWithGemini(
  transcript: string,
  audioUris?: string[],
  context?: {
    title?: string;
    category?: string;
    targetLanguage?: string;
  }
): Promise<{
  isLanguagePractice: boolean;
  issues: Array<{
    original: string;
    corrected: string;
    explanation: string;
    category: string;
  }>;
}> {
  if (audioUris && audioUris.length > 8) throw new Error("Too many audio files");
  try {
    const targetLang = context?.targetLanguage || "Spanish";

    const prompt = `You are a context-aware language learning assistant.

CONTEXT:
- Target Language: ${targetLang}
${context?.title ? `- Conversation Title: "${context.title}"` : ''}
${context?.category ? `- Category: ${context.category}` : ''}

TASK 1: Determine if this is LANGUAGE PRACTICE or a NORMAL CONVERSATION
Language practice indicators:
- User is practicing ${targetLang} specifically
- Responding to language challenges or prompts
- Deliberately practicing grammar/vocabulary
- Self-correcting or asking for corrections
- Speaking slowly/carefully in ${targetLang}

Normal conversation indicators:
- Casual chat with friends/family
- Work meetings or business calls
- Natural conversation in native language
- Bilingual switching for practical communication
- Not focused on learning

TASK 2: Only if this IS language practice, analyze for improvement opportunities.
${audioUris && audioUris.length > 0 ? 'IMPORTANT: You have REAL AUDIO. Use it to evaluate ACTUAL pronunciation, intonation, accent, and rhythm.' : ''}

Find up to 3 learning opportunities:
- original: exact phrase that needs improvement
- corrected: better idiomatic version
- explanation: brief, friendly explanation (why natives say it this way)
- category: "grammar", "vocabulary", "pronunciation", or "idiomatic"

Transcript:
"${transcript.substring(0, 2000)}"

Respond in JSON format:
{
  "isLanguagePractice": true/false,
  "issues": [
    {"original": "...", "corrected": "...", "explanation": "...", "category": "..."}
  ]
}

If NOT language practice, respond: {"isLanguagePractice": false, "issues": []}
If language practice but no issues: {"isLanguagePractice": true, "issues": []}
Respond ONLY with valid JSON.`;

    // Prepare content parts - start with transcript
    const contentParts: any[] = [{ text: prompt }];

    // If audio URIs provided, download and include audio data
    if (audioUris && audioUris.length > 0) {
      /* Private payloads are not logged. */

      const { downloadAudioChunk } = await import("./gcp-storage");

      for (const uri of audioUris) {
        try {
          /* Private payloads are not logged. */
          const audioData = await downloadAudioChunk(uri);

          contentParts.push({
            inlineData: {
              mimeType: "audio/wav",
              data: audioData.toString('base64')
            }
          });
        } catch (audioError) {
          /* Private payloads are not logged. */
        }
      }

      if (contentParts.length > 1) {
        contentParts.push({
          text: "\n\nAudio file(s) provided above. Use them to evaluate ACTUAL pronunciation, intonation, rhythm, and accent. Give precise pronunciation feedback based on the audio."
        });
      }
    }

    if (!ai) throw new Error("Gemini is not configured");
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: contentParts,
      config: audioUris && audioUris.length > 0 ? {
        maxOutputTokens: 8000  // More tokens for detailed audio analysis
      } : undefined
    });

    const responseText = response.text || '{"isLanguagePractice": false, "issues": []}';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isLanguagePractice: parsed.isLanguagePractice ?? false,
        issues: parsed.issues || []
      };
    }

    throw new Error("Conversation analysis unavailable");
  } catch (error) {
    /* Private payloads are not logged. */
    throw new Error("Conversation analysis unavailable");
  }
}
