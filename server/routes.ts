import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const DEFAULT_USER_ID = "demo-user";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/stats/overview", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getOverviewStats(DEFAULT_USER_ID);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching overview stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/stats/weekly", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getWeeklyStats(DEFAULT_USER_ID);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching weekly stats:", error);
      res.status(500).json({ error: "Failed to fetch weekly stats" });
    }
  });

  app.get("/api/stats/progress", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getProgressStats(DEFAULT_USER_ID);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching progress stats:", error);
      res.status(500).json({ error: "Failed to fetch progress stats" });
    }
  });

  app.get("/api/challenges/today", async (req: Request, res: Response) => {
    try {
      const challenges = await storage.getDailyChallenges(DEFAULT_USER_ID);
      res.json(challenges);
    } catch (error) {
      console.error("Error fetching daily challenges:", error);
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  app.patch("/api/challenges/:id/complete", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { quality } = req.body;
      
      const challenge = await storage.completeChallenge(id, quality || 5);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const user = await storage.getUser(DEFAULT_USER_ID);
      if (user) {
        await storage.updateUserStats(DEFAULT_USER_ID, {
          totalXp: (user.totalXp || 0) + (challenge.xpEarned || 25),
        });
      }

      res.json(challenge);
    } catch (error) {
      console.error("Error completing challenge:", error);
      res.status(500).json({ error: "Failed to complete challenge" });
    }
  });

  app.get("/api/learning-items", async (req: Request, res: Response) => {
    try {
      const items = await storage.getLearningItems(DEFAULT_USER_ID);
      res.json(items);
    } catch (error) {
      console.error("Error fetching learning items:", error);
      res.status(500).json({ error: "Failed to fetch learning items" });
    }
  });

  app.post("/api/learning-items", async (req: Request, res: Response) => {
    try {
      const item = await storage.createLearningItem({
        userId: DEFAULT_USER_ID,
        ...req.body,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating learning item:", error);
      res.status(500).json({ error: "Failed to create learning item" });
    }
  });

  app.get("/api/achievements", async (req: Request, res: Response) => {
    try {
      const achievements = await storage.getAchievements(DEFAULT_USER_ID);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ error: "Failed to fetch achievements" });
    }
  });

  app.post("/api/omi/audio", async (req: Request, res: Response) => {
    try {
      const { uid, sample_rate = 16000 } = req.query;
      
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Error processing audio:", error);
      res.status(500).json({ error: "Failed to process audio" });
    }
  });

  app.post("/api/omi/transcript", async (req: Request, res: Response) => {
    try {
      const { session_id, segments } = req.body;
      
      if (segments && Array.isArray(segments)) {
        const userSegments = segments.filter((seg: { is_user?: boolean }) => seg.is_user);
        
        for (const segment of userSegments) {
          if (segment.text && segment.text.length > 10) {
            try {
              const analysis = await analyzeTextWithGemini(segment.text);
              
              if (analysis.hasIssues && analysis.original && analysis.corrected) {
                await storage.createLearningItem({
                  userId: DEFAULT_USER_ID,
                  sessionId: session_id,
                  originalText: analysis.original,
                  correctedText: analysis.corrected,
                  explanation: analysis.explanation || "Grammar correction",
                  category: analysis.category || "grammar",
                });

                await storage.createDailyChallenge({
                  userId: DEFAULT_USER_ID,
                  learningItemId: null,
                  challengeText: `Practice: ${analysis.corrected}`,
                  xpEarned: 25,
                });
              }
            } catch (analysisError) {
              console.error("Error analyzing segment:", analysisError);
            }
          }
        }
      }

      res.json({ status: "ok", processed: segments?.length || 0 });
    } catch (error) {
      console.error("Error processing transcript:", error);
      res.status(500).json({ error: "Failed to process transcript" });
    }
  });

  app.post("/api/analyze-text", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const analysis = await analyzeTextWithGemini(text);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing text:", error);
      res.status(500).json({ error: "Failed to analyze text" });
    }
  });

  return httpServer;
}

async function analyzeTextWithGemini(text: string): Promise<{
  hasIssues: boolean;
  original?: string;
  corrected?: string;
  explanation?: string;
  category?: string;
}> {
  try {
    const prompt = `Analyze the following spoken English text for grammar, vocabulary, or pronunciation issues. 
If there are issues, respond in JSON format with:
- hasIssues: true
- original: the problematic phrase
- corrected: the corrected version
- explanation: brief explanation of the error
- category: "grammar", "vocabulary", or "pronunciation"

If the text is correct, respond with: {"hasIssues": false}

Text: "${text}"

Respond ONLY with valid JSON, no other text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const responseText = response.text || '{"hasIssues": false}';
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { hasIssues: false };
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return { hasIssues: false };
  }
}
