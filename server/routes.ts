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

function getBaseUrl(req: Request): string {
  const host = req.get('host') || 'localhost:5000';
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${protocol}://${host}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============================================
  // OMI INTEGRATION ENDPOINTS
  // ============================================

  // Chat Tools Manifest - Required for Omi App Store
  // Format: https://docs.omi.me/doc/developer/apps/ChatTools
  app.get("/.well-known/omi-tools.json", (req: Request, res: Response) => {
    const manifest = {
      tools: [
        {
          name: "analyze_speech",
          description: "Analyze the user's speech for grammar, vocabulary, or pronunciation issues. Use this when the user wants feedback on something they said or how to say something better in their target language.",
          endpoint: "/api/omi/tools/analyze",
          method: "POST",
          parameters: {
            properties: {
              text: {
                type: "string",
                description: "The text or phrase to analyze for language learning"
              },
              target_language: {
                type: "string",
                description: "The language to analyze (e.g., 'English', 'Spanish')"
              }
            },
            required: ["text"]
          },
          auth_required: false,
          status_message: "Analyzing your speech..."
        },
        {
          name: "get_learning_status",
          description: "Get the user's current learning progress, streak, XP, and pending challenges. Use this when the user asks about their progress or language learning stats.",
          endpoint: "/api/omi/tools/status",
          method: "POST",
          parameters: {
            properties: {},
            required: []
          },
          auth_required: false,
          status_message: "Getting your learning status..."
        },
        {
          name: "add_to_learning_queue",
          description: "Add a phrase or grammar point to the user's learning queue for spaced repetition practice. Use this when the user wants to remember or practice something specific.",
          endpoint: "/api/omi/tools/add-item",
          method: "POST",
          parameters: {
            properties: {
              original_text: {
                type: "string",
                description: "The incorrect or original phrase"
              },
              corrected_text: {
                type: "string",
                description: "The corrected or better version"
              },
              explanation: {
                type: "string",
                description: "Brief explanation of why this is better"
              },
              category: {
                type: "string",
                description: "Category: grammar, vocabulary, or pronunciation"
              }
            },
            required: ["original_text", "corrected_text"]
          },
          auth_required: false,
          status_message: "Adding to your learning queue..."
        },
        {
          name: "get_daily_challenges",
          description: "Get today's language learning challenges. Use this when the user wants to practice or asks what they should work on today.",
          endpoint: "/api/omi/tools/challenges",
          method: "POST",
          parameters: {
            properties: {},
            required: []
          },
          auth_required: false,
          status_message: "Getting your daily challenges..."
        }
      ]
    };

    res.json(manifest);
  });

  // Setup Complete Callback - Called by Omi when user installs the app
  // GET endpoint returning {"is_setup_completed": boolean}
  app.get("/api/omi/setup-complete", async (req: Request, res: Response) => {
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
      console.error("Error checking setup status:", error);
      res.json({ is_setup_completed: false });
    }
  });

  // POST version for explicit setup completion notification
  app.post("/api/omi/setup-complete", async (req: Request, res: Response) => {
    try {
      const uid = (req.query.uid as string) || req.body?.uid;
      
      if (!uid) {
        return res.status(400).json({ status: "error", message: "Missing uid" });
      }
      
      console.log(`Omi setup completed for user: ${uid}`);
      
      // Store the Omi connection
      await storage.createOmiConnection({
        omiUid: uid,
        userId: DEFAULT_USER_ID,
        appId: req.body?.app_id,
        status: "connected"
      });

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Error in setup-complete:", error);
      res.status(500).json({ status: "error" });
    }
  });

  // Real-time Transcript Webhook
  // Omi sends: POST /endpoint?session_id=abc123&uid=user123
  // Body: Array of transcript segments
  app.post("/api/omi/webhook/transcript", async (req: Request, res: Response) => {
    try {
      const session_id = req.query.session_id as string;
      const uid = req.query.uid as string;
      const segments = req.body; // Array of segments directly in body
      
      console.log(`Received transcript from Omi. UID: ${uid}, Session: ${session_id}, Segments: ${Array.isArray(segments) ? segments.length : 0}`);

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
                  userId: DEFAULT_USER_ID,
                  sessionId: session_id,
                  originalText: analysis.original,
                  correctedText: analysis.corrected,
                  explanation: analysis.explanation || "Language correction",
                  category: analysis.category || "grammar",
                });

                // Create a challenge for this item
                await storage.createDailyChallenge({
                  userId: DEFAULT_USER_ID,
                  learningItemId: item.id,
                  challengeText: `Practice: ${analysis.corrected}`,
                  xpEarned: 25,
                });

                console.log(`Created learning item: ${analysis.original} -> ${analysis.corrected}`);
              }
            } catch (analysisError) {
              console.error("Error analyzing segment:", analysisError);
            }
          }
        }
      }

      res.json({ status: "ok" });
    } catch (error) {
      console.error("Error processing transcript:", error);
      res.status(500).json({ status: "error" });
    }
  });

  // Memory Trigger Webhook - Called when a conversation ends
  // Omi sends: POST /endpoint?uid=user123
  // Body: Memory object with id, transcript_segments, structured, etc.
  app.post("/api/omi/webhook/memory", async (req: Request, res: Response) => {
    try {
      const uid = req.query.uid as string;
      const memory = req.body;
      
      console.log(`Received memory from Omi. UID: ${uid}, Memory ID: ${memory?.id}`);

      // Process transcript segments from the memory
      const segments = memory?.transcript_segments;
      if (Array.isArray(segments) && segments.length > 0) {
        // Combine all user segments into a transcript
        const userText = segments
          .filter((seg: { is_user?: boolean }) => seg.is_user === true)
          .map((seg: { text: string }) => seg.text)
          .join(' ');
        
        if (userText.length > 20) {
          const analysis = await analyzeConversationWithGemini(userText);
          
          if (analysis.issues && analysis.issues.length > 0) {
            for (const issue of analysis.issues) {
              await storage.createLearningItem({
                userId: DEFAULT_USER_ID,
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
      console.error("Error processing memory:", error);
      res.status(500).json({ status: "error" });
    }
  });

  // ============================================
  // OMI CHAT TOOLS (Called by Omi when user invokes tools)
  // Return format: { result: string } or { error: string }
  // ============================================

  // Analyze speech tool
  app.post("/api/omi/tools/analyze", async (req: Request, res: Response) => {
    try {
      const { text, target_language } = req.body;
      
      if (!text) {
        return res.json({ error: "Please provide some text to analyze" });
      }

      const analysis = await analyzeTextWithGemini(text, target_language);

      if (analysis.hasIssues) {
        // Save to learning queue
        await storage.createLearningItem({
          userId: DEFAULT_USER_ID,
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
      console.error("Error in analyze tool:", error);
      res.json({ error: "Sorry, I couldn't analyze that right now. Try again?" });
    }
  });

  // Get learning status tool
  app.post("/api/omi/tools/status", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getOverviewStats(DEFAULT_USER_ID);
      const user = await storage.getUser(DEFAULT_USER_ID);

      const result = `Here's your LinguaFlow status:\n\n` +
        `Streak: ${stats.streak} days\n` +
        `Level: ${user?.level || 1}\n` +
        `Total XP: ${user?.totalXp || 0}\n` +
        `Today's Progress: ${stats.todayCompleted}/${stats.todayTotal} challenges\n` +
        `Learning Items: ${stats.totalItems} in queue\n\n` +
        `Keep practicing to maintain your streak!`;

      res.json({ result });
    } catch (error) {
      console.error("Error in status tool:", error);
      res.json({ error: "Couldn't fetch your status right now" });
    }
  });

  // Add to learning queue tool
  app.post("/api/omi/tools/add-item", async (req: Request, res: Response) => {
    try {
      const { original_text, corrected_text, explanation, category } = req.body;

      if (!original_text || !corrected_text) {
        return res.json({ error: "Please provide both the original and corrected text" });
      }

      await storage.createLearningItem({
        userId: DEFAULT_USER_ID,
        originalText: original_text,
        correctedText: corrected_text,
        explanation: explanation || "Custom learning item",
        category: category || "vocabulary",
      });

      res.json({
        result: `Added to your learning queue!\n\n"${original_text}" -> "${corrected_text}"\n\nI'll remind you to practice this using spaced repetition.`
      });
    } catch (error) {
      console.error("Error in add-item tool:", error);
      res.json({ error: "Couldn't add to your queue right now" });
    }
  });

  // Get daily challenges tool
  app.post("/api/omi/tools/challenges", async (req: Request, res: Response) => {
    try {
      const challenges = await storage.getDailyChallenges(DEFAULT_USER_ID);
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
      console.error("Error in challenges tool:", error);
      res.json({ error: "Couldn't fetch your challenges right now" });
    }
  });

  // ============================================
  // SETUP & STATUS ENDPOINTS
  // ============================================

  // Get Omi setup info for the settings page
  app.get("/api/omi/setup-info", (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    
    res.json({
      webhooks: {
        transcript: `${baseUrl}/api/omi/webhook/transcript`,
        memory: `${baseUrl}/api/omi/webhook/memory`,
      },
      manifest_url: `${baseUrl}/.well-known/omi-tools.json`,
      setup_complete_url: `${baseUrl}/api/omi/setup-complete`,
      app_home_url: `${baseUrl}/dashboard`,
      instructions: [
        "1. Open the Omi app on your phone",
        "2. Go to Apps -> Create App (or Explore -> Create App)",
        "3. Select 'External Integration' capability",
        "4. Enable 'Real-time Transcript' and paste the transcript webhook URL",
        "5. (Optional) Enable 'Memory Trigger' and paste the memory webhook URL",
        "6. Add the Chat Tools Manifest URL to enable AI tools",
        "7. Set the Setup Complete URL",
        "8. Save and install your app!"
      ]
    });
  });

  // Check Omi connection status
  app.get("/api/omi/status", async (req: Request, res: Response) => {
    try {
      const connection = await storage.getOmiConnection(DEFAULT_USER_ID);
      res.json({
        connected: !!connection,
        connection: connection || null
      });
    } catch (error) {
      res.json({ connected: false, connection: null });
    }
  });

  // ============================================
  // EXISTING APP ENDPOINTS
  // ============================================

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

async function analyzeTextWithGemini(text: string, targetLanguage?: string): Promise<{
  hasIssues: boolean;
  original?: string;
  corrected?: string;
  explanation?: string;
  category?: string;
}> {
  try {
    const lang = targetLanguage || "English";
    const prompt = `You are a language learning assistant. Analyze the following ${lang} text for grammar, vocabulary, or pronunciation issues.

If there are issues, respond in JSON format with:
- hasIssues: true
- original: the problematic phrase (the part that needs fixing)
- corrected: the corrected version
- explanation: brief, friendly explanation of the error (1-2 sentences)
- category: "grammar", "vocabulary", or "pronunciation"

If the text is correct, respond with: {"hasIssues": false}

Text to analyze: "${text}"

Respond ONLY with valid JSON, no other text or markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const responseText = response.text || '{"hasIssues": false}';
    
    // Extract JSON from response
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

async function analyzeConversationWithGemini(transcript: string): Promise<{
  issues: Array<{
    original: string;
    corrected: string;
    explanation: string;
    category: string;
  }>;
}> {
  try {
    const prompt = `You are a language learning assistant. Analyze this conversation transcript for grammar, vocabulary, or pronunciation issues that a language learner should practice.

Find up to 3 learning opportunities. For each issue, provide:
- original: the exact phrase that needs improvement
- corrected: the better version
- explanation: brief, friendly explanation
- category: "grammar", "vocabulary", or "pronunciation"

Transcript:
"${transcript.substring(0, 2000)}"

Respond in JSON format:
{
  "issues": [
    {"original": "...", "corrected": "...", "explanation": "...", "category": "grammar"}
  ]
}

If no issues found, respond with: {"issues": []}
Respond ONLY with valid JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const responseText = response.text || '{"issues": []}';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { issues: [] };
  } catch (error) {
    console.error("Gemini conversation analysis error:", error);
    return { issues: [] };
  }
}
