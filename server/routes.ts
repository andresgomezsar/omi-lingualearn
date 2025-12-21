import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenAI } from "@google/genai";
import * as gcpStorage from "./gcp-storage";

// Using direct Gemini API key from Google
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

const DEFAULT_USER_ID = "demo-user";

// In-memory audio buffer for accumulating chunks per user+session
// When buffer reaches ~1 minute of audio, compile to WAV and upload
interface AudioBuffer {
  chunks: Buffer[];
  startTimestamp: Date;
  sampleRate: number;
  totalBytes: number;
}

// Key format: "userId:sessionId" to avoid cross-session mixing
const audioBuffers: Map<string, AudioBuffer> = new Map();

// Target: ~1 minute of audio at 16kHz, 16-bit mono = 16000 * 2 * 60 = 1,920,000 bytes
const TARGET_AUDIO_BYTES = 1920000;

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

  // Real-time Audio Bytes Webhook
  // Omi sends: POST /endpoint?sample_rate=16000&uid=user123
  // Body: Raw PCM16 audio bytes (application/octet-stream)
  app.post("/api/omi/webhook/audio", async (req: Request, res: Response) => {
    try {
      const uid = req.query.uid as string;
      const sampleRate = parseInt(req.query.sample_rate as string) || 16000;
      const sessionId = req.query.session_id as string || `audio-${Date.now()}`;
      
      // Get raw audio buffer from request body
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const audioBuffer = Buffer.concat(chunks);
          
          if (audioBuffer.length === 0) {
            console.log(`Received empty audio chunk from UID: ${uid}`);
            return res.json({ status: "ok" });
          }

          console.log(`Received audio bytes from Omi. UID: ${uid}, Session: ${sessionId}, Size: ${audioBuffer.length} bytes, Sample Rate: ${sampleRate}`);

          // Check if GCP is configured
          if (!gcpStorage.isConfigured()) {
            console.log("GCP storage not configured, skipping audio upload");
            return res.json({ status: "ok", message: "GCP not configured" });
          }

          // Get existing chunks for this session to determine index
          const existingChunks = await storage.getAudioChunks(sessionId);
          const chunkIndex = existingChunks.length;
          const timestamp = Date.now();

          // Calculate duration based on sample rate and buffer size
          // PCM16 = 2 bytes per sample
          const samples = audioBuffer.length / 2;
          const durationMs = Math.round((samples / sampleRate) * 1000);

          // Upload to GCP bucket
          const gcpUri = await gcpStorage.uploadAudioChunk(
            uid || DEFAULT_USER_ID,
            sessionId,
            audioBuffer,
            timestamp,
            chunkIndex
          );

          // Store chunk metadata
          await storage.createAudioChunk({
            sessionId,
            userId: uid || DEFAULT_USER_ID,
            gcpUri,
            startMs: chunkIndex > 0 ? existingChunks[chunkIndex - 1]?.endMs || 0 : 0,
            endMs: (chunkIndex > 0 ? existingChunks[chunkIndex - 1]?.endMs || 0 : 0) + durationMs,
            sampleRate,
            durationMs,
            chunkIndex,
          });

          console.log(`Stored audio chunk ${chunkIndex} for session ${sessionId}: ${gcpUri}`);
          res.json({ status: "ok" });
        } catch (uploadError) {
          console.error("Error uploading audio:", uploadError);
          res.status(500).json({ status: "error" });
        }
      });
    } catch (error) {
      console.error("Error processing audio bytes:", error);
      res.status(500).json({ status: "error" });
    }
  });

  // Trigger audio compilation and analysis for a session
  app.post("/api/omi/compile-session/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const uid = req.query.uid as string || DEFAULT_USER_ID;

      // Get all audio chunks for this session
      const chunks = await storage.getAudioChunks(sessionId);
      if (chunks.length === 0) {
        return res.status(404).json({ error: "No audio chunks found for session" });
      }

      // Get transcript segments for this session
      const segments = await storage.getTranscriptSegments(sessionId);
      const transcriptText = segments
        .filter(s => s.isUser)
        .map(s => s.text)
        .join(' ');

      console.log(`Compiling session ${sessionId}: ${chunks.length} audio chunks, ${segments.length} transcript segments`);

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
          const sampleRate = chunks[0]?.sampleRate || 16000;
          
          // Upload compiled audio with proper WAV header
          const startTime = chunks[0]?.createdAt || new Date();
          const endTime = chunks[chunks.length - 1]?.createdAt || new Date();
          const result = await gcpStorage.uploadCompiledWav(uid, compiledPcm, sampleRate, startTime, endTime);
          compiledAudioUri = result.gcpUri;
          console.log(`Compiled audio uploaded: ${compiledAudioUri}`);

          // Update analysis with compiled audio URI
          await storage.updateAudioAnalysis(analysis.id, {
            compiledAudioUri,
          });
        } catch (audioError) {
          console.error("Error compiling audio:", audioError);
          // Continue with text-based analysis even if audio compilation fails
        }
      }

      // Perform text-based analysis with Gemini
      if (transcriptText && transcriptText.length > 20) {
        const geminiAnalysis = await analyzeConversationWithGemini(transcriptText);
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
        pronunciationScore = Math.round(100 - (pronunciationIssues * 15));
        
        // Generate lessons from issues found
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
      console.error("Error compiling session:", error);
      res.status(500).json({ error: "Failed to compile session" });
    }
  });

  // Get audio analysis status
  app.get("/api/audio-analysis/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const analysis = await storage.getAudioAnalysis(sessionId);
      
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ error: "Failed to fetch analysis" });
    }
  });

  // Get lessons for user
  app.get("/api/lessons", async (req: Request, res: Response) => {
    try {
      const lessons = await storage.getLessons(DEFAULT_USER_ID);
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching lessons:", error);
      res.status(500).json({ error: "Failed to fetch lessons" });
    }
  });

  // Complete a lesson
  app.patch("/api/lessons/:id/complete", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const lesson = await storage.completeLesson(id);
      
      if (!lesson) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      // Award XP
      const user = await storage.getUser(DEFAULT_USER_ID);
      if (user) {
        await storage.updateUserStats(DEFAULT_USER_ID, {
          totalXp: (user.totalXp || 0) + (lesson.xpReward || 50),
        });
      }

      res.json(lesson);
    } catch (error) {
      console.error("Error completing lesson:", error);
      res.status(500).json({ error: "Failed to complete lesson" });
    }
  });

  // Get GCP status
  app.get("/api/gcp/status", async (req: Request, res: Response) => {
    try {
      const configured = gcpStorage.isConfigured();
      let connected = false;
      
      if (configured) {
        connected = await gcpStorage.testConnection();
      }

      res.json({ configured, connected });
    } catch (error) {
      res.json({ configured: false, connected: false, error: String(error) });
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
  // UNIFIED OMI HUB ENDPOINT
  // ============================================
  // Single URL that handles all Omi callbacks via query parameter routing
  // Use: /api/omi/hub?event=transcript|audio|memory|setup_complete

  // GET handler for setup_complete check and app home
  app.get("/api/omi/hub", async (req: Request, res: Response) => {
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
        console.error("Error checking setup status:", error);
        return res.json({ is_setup_completed: false });
      }
    }

    // Default: redirect to app home (dashboard)
    const baseUrl = getBaseUrl(req);
    res.redirect(`${baseUrl}/dashboard`);
  });

  // POST handler for webhooks and setup_complete notification
  // Auto-detects event type from payload if not specified in query
  app.post("/api/omi/hub", async (req: Request, res: Response) => {
    let event = req.query.event as string;
    const uid = req.query.uid as string;
    const session_id = req.query.session_id as string;
    const contentType = req.headers['content-type'] || '';

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
        console.log('Could not auto-detect event type, payload:', JSON.stringify(body).slice(0, 200));
        event = 'unknown';
      }
    }

    console.log(`Omi Hub received: event=${event}, uid=${uid}, session_id=${session_id}`);

    try {
      switch (event) {
        case "transcript": {
          // Handle real-time transcript
          const segments = req.body;
          const userId = uid || DEFAULT_USER_ID;
          console.log(`Processing transcript: ${Array.isArray(segments) ? segments.length : 0} segments`);

          if (Array.isArray(segments) && segments.length > 0) {
            const userSegments = segments.filter((seg: { is_user?: boolean }) => seg.is_user === true);
            
            // Combine all user text to check for trigger phrases
            const fullUserText = userSegments.map((seg: { text: string }) => seg.text).join(' ').toLowerCase();
            
            // Trigger phrase detection for Voice Coach Challenge
            const triggerPhrases = ['lingua learn', 'lingualearn', 'voice coach', 'lingua challenge', 'start challenge'];
            const hasTriggerPhrase = triggerPhrases.some(phrase => fullUserText.includes(phrase));
            
            if (hasTriggerPhrase) {
              console.log(`Trigger phrase detected for user ${userId}: "${fullUserText.slice(0, 50)}..."`);
              
              // Check if there's already an active challenge
              const activeChallenge = await storage.getActiveVoiceChallenge(userId);
              
              if (!activeChallenge) {
                // Generate a new challenge
                try {
                  const { generateChallengePrompt } = await import("./gemini-challenge");
                  
                  // Get a random user fact
                  let userFact = await storage.getRandomUserFact(userId);
                  if (!userFact) {
                    // Create default facts if none exist
                    await storage.createUserFact({
                      userId,
                      content: "User enjoys daily conversations and wants to improve language skills",
                      category: "goal",
                    });
                    userFact = await storage.getRandomUserFact(userId);
                  }
                  
                  if (userFact) {
                    const generated = await generateChallengePrompt(userFact, "Spanish");
                    
                    const challenge = await storage.createVoiceChallenge({
                      userId,
                      status: "active",
                      sourceFact: userFact.content,
                      sourceFactId: userFact.id.toString(),
                      prompt: generated.prompt,
                      languageGoal: generated.languageGoal,
                      targetLanguage: "Spanish",
                      difficulty: generated.difficulty,
                      xpEarned: 0,
                      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    });
                    
                    console.log(`Generated new voice challenge ${challenge.id} for user ${userId}: "${generated.prompt.slice(0, 80)}..."`);
                  }
                } catch (error) {
                  console.error("Error generating challenge from trigger:", error);
                }
              } else {
                console.log(`User ${userId} already has active challenge ${activeChallenge.id}`);
              }
            } else {
              // Check if user has an active challenge and this might be their response
              const activeChallenge = await storage.getActiveVoiceChallenge(userId);
              
              if (activeChallenge && fullUserText.length > 30) {
                // This looks like a challenge response - submit it!
                console.log(`Detected potential challenge response for challenge ${activeChallenge.id}`);
                
                // Don't auto-submit from transcript - let the memory event handle full responses
                // This avoids analyzing incomplete sentences
              }
            }
            
            // Store segments
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

            // Standard language analysis for learning items (only if not a challenge response)
            if (!hasTriggerPhrase) {
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
                    console.error("Error analyzing segment:", analysisError);
                  }
                }
              }
            }
          }
          return res.json({ status: "ok" });
        }

        case "audio": {
          // Handle audio bytes - accumulate and compile ~1 minute WAV files
          const sampleRate = parseInt(req.query.sample_rate as string) || 16000;
          const userId = uid || DEFAULT_USER_ID;
          const sessionId = session_id || "default";
          const bufferKey = `${userId}:${sessionId}`;
          
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', async () => {
            try {
              const audioChunk = Buffer.concat(chunks);
              
              if (audioChunk.length === 0) {
                return res.json({ status: "ok" });
              }

              if (!gcpStorage.isConfigured()) {
                console.log("GCP not configured, skipping audio storage");
                return res.json({ status: "ok", message: "GCP not configured" });
              }

              // Get or create buffer for this user+session
              let buffer = audioBuffers.get(bufferKey);
              if (!buffer) {
                buffer = {
                  chunks: [],
                  startTimestamp: new Date(),
                  sampleRate,
                  totalBytes: 0
                };
                audioBuffers.set(bufferKey, buffer);
              }

              // Add chunk to buffer
              buffer.chunks.push(audioChunk);
              buffer.totalBytes += audioChunk.length;
              
              console.log(`Audio buffer for ${bufferKey}: ${buffer.totalBytes} bytes (${Math.round(buffer.totalBytes / TARGET_AUDIO_BYTES * 100)}% of target)`);

              // Check if we've accumulated ~1 minute of audio
              if (buffer.totalBytes >= TARGET_AUDIO_BYTES) {
                const endTimestamp = new Date();
                const allPcmData = Buffer.concat(buffer.chunks);
                
                // Take exactly TARGET_AUDIO_BYTES for this compilation, preserve the rest
                const pcmToCompile = allPcmData.subarray(0, TARGET_AUDIO_BYTES);
                const leftoverPcm = allPcmData.subarray(TARGET_AUDIO_BYTES);
                
                const durationMs = Math.round((pcmToCompile.length / 2 / sampleRate) * 1000);
                
                console.log(`Compiling ${durationMs}ms of audio for ${bufferKey}, ${leftoverPcm.length} bytes leftover...`);
                
                try {
                  // Upload compiled WAV to GCP
                  const { gcpUri, fileSize } = await gcpStorage.uploadCompiledWav(
                    userId,
                    pcmToCompile,
                    sampleRate,
                    buffer.startTimestamp,
                    endTimestamp
                  );
                  
                  // Store metadata in database
                  await storage.createCompiledAudioFile({
                    userId,
                    gcpUri,
                    startTimestamp: buffer.startTimestamp,
                    endTimestamp,
                    durationMs,
                    sampleRate,
                    fileSize
                  });
                  
                  console.log(`Compiled WAV uploaded: ${gcpUri}`);
                } catch (uploadError) {
                  console.error("Error uploading compiled WAV:", uploadError);
                }
                
                // Start new buffer with leftover data
                audioBuffers.set(bufferKey, {
                  chunks: leftoverPcm.length > 0 ? [leftoverPcm] : [],
                  startTimestamp: new Date(),
                  sampleRate,
                  totalBytes: leftoverPcm.length
                });
              }

              res.json({ status: "ok" });
            } catch (error) {
              console.error("Error processing audio:", error);
              res.status(500).json({ status: "error" });
            }
          });
          return;
        }

        case "memory": {
          // Handle memory trigger (conversation end)
          const memory = req.body;
          const segments = memory?.transcript_segments;
          const userId = uid || DEFAULT_USER_ID;
          
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
                console.log(`Auto-submitting challenge response for challenge ${activeChallenge.id}: "${userSpeech.slice(0, 100)}..."`);
                
                try {
                  const { analyzeChallengeResponse } = await import("./gemini-challenge");
                  const feedback = await analyzeChallengeResponse(activeChallenge, userSpeech);
                  
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
                  
                  console.log(`Challenge ${activeChallenge.id} completed with score ${feedback.overallScore}, XP earned: ${updatedChallenge.xpEarned}`);
                  
                  // Skip normal analysis for this memory since it was a challenge response
                  return res.json({ status: "ok", challenge_completed: true, xp_earned: updatedChallenge.xpEarned });
                } catch (error) {
                  console.error("Error processing challenge response:", error);
                }
              }
            }
            
            // Check if any segment has a real speaker name (not "Speaker 1" etc.)
            const segmentsWithRealNames = segments.filter((seg: { speaker?: string }) => 
              isRealSpeakerName(seg.speaker)
            );
            
            const hasRealSpeakerName = segmentsWithRealNames.length > 0;
            
            console.log(`Memory event: ${segments.length} segments, ${segmentsWithRealNames.length} with real names, hasRealName=${hasRealSpeakerName}`);
            
            // Only analyze if there's a real speaker name (saves costs)
            if (hasRealSpeakerName) {
              // Get the time range of segments with real names
              const segmentTimes = segmentsWithRealNames
                .filter((seg: { start?: number; end?: number }) => seg.start !== undefined && seg.end !== undefined)
                .map((seg: { start: number; end: number }) => ({ start: seg.start, end: seg.end }));
              
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
                
                console.log(`Found ${matchingAudioFiles.length} audio files matching time range ${startTime.toISOString()} - ${endTime.toISOString()}`);
                
                // Get text from segments with real names for analysis
                const userText = segmentsWithRealNames
                  .filter((seg: { is_user?: boolean }) => seg.is_user === true)
                  .map((seg: { text: string }) => seg.text)
                  .join(' ');
                
                if (userText.length > 20) {
                  console.log(`Analyzing transcript with real speaker names: "${userText.slice(0, 100)}..."`);
                  
                  const analysis = await analyzeConversationWithGemini(userText);
                  
                  if (analysis.issues && analysis.issues.length > 0) {
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
                    
                    console.log(`Created ${analysis.issues.length} learning items from analysis`);
                  }
                }
                
                // TODO: If matchingAudioFiles.length > 0, could send audio to Gemini for pronunciation analysis
                if (matchingAudioFiles.length > 0) {
                  console.log(`Audio files available for pronunciation analysis: ${matchingAudioFiles.map(f => f.gcpUri).join(', ')}`);
                }
              }
            } else {
              console.log("No real speaker names found, skipping analysis to save costs");
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
          
          await storage.createOmiConnection({
            omiUid,
            userId: DEFAULT_USER_ID,
            appId: req.body?.app_id,
            status: "connected"
          });
          
          return res.json({ status: "ok" });
        }

        case "unknown":
        default:
          // Unknown or undetected event type - still respond OK
          console.log(`Unknown hub event: ${event}, body keys: ${Object.keys(req.body || {}).join(', ')}`);
          return res.json({ status: "ok", message: "Event processed" });
      }
    } catch (error) {
      console.error(`Error processing hub event ${event}:`, error);
      res.status(500).json({ status: "error" });
    }
  });

  // ============================================
  // SETUP & STATUS ENDPOINTS
  // ============================================

  // Get Omi setup info for the settings page
  app.get("/api/omi/setup-info", (req: Request, res: Response) => {
    const baseUrl = getBaseUrl(req);
    const hubUrl = `${baseUrl}/api/omi/hub`;
    
    res.json({
      // Primary unified webhook URL - use this for all callbacks
      hub_url: hubUrl,
      
      // Event-specific URLs (all route through the hub)
      webhooks: {
        transcript: `${hubUrl}?event=transcript`,
        audio: `${hubUrl}?event=audio`,
        memory: `${hubUrl}?event=memory`,
      },
      
      // Configuration URLs
      setup_complete_url: `${hubUrl}?event=setup_complete`,
      app_home_url: hubUrl, // GET request redirects to /dashboard
      auth_url: hubUrl, // Same as app_home for authentication
      manifest_url: `${baseUrl}/.well-known/omi-tools.json`,
      
      gcp_configured: gcpStorage.isConfigured(),
      
      instructions: [
        "1. Open the Omi app on your phone",
        "2. Go to Apps -> Create App (or Explore -> Create App)",
        "3. Select 'External Integration' capability",
        "4. Use the Hub URL for ALL webhook fields:",
        `   ${hubUrl}`,
        "5. The Hub auto-detects transcript, audio, memory, and setup events",
        "6. For App Home URL and Auth URL, use the same Hub URL",
        "7. Add the Chat Tools Manifest URL to enable AI tools",
        "8. Save and install your app!"
      ],
      
      // Quick copy section for single-webhook limitation
      single_url_mode: {
        description: "If Omi only allows one webhook URL, use this single URL with different event parameters",
        base_url: hubUrl,
        events: ["transcript", "audio", "memory", "setup_complete"],
        example: `${hubUrl}?event=transcript&uid=YOUR_USER_ID&session_id=SESSION_ID`
      }
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
  // AUTH & USER ENDPOINTS
  // ============================================

  // Login with Omi UID - creates user if doesn't exist, returns user data
  app.post("/api/auth/login-omi", async (req: Request, res: Response) => {
    try {
      const { omiUid } = req.body;
      if (!omiUid || typeof omiUid !== 'string' || omiUid.length < 5) {
        return res.status(400).json({ error: "Valid Omi UID is required" });
      }

      // Check if user exists with this Omi UID
      let user = await storage.getUserByOmiUid(omiUid);
      
      if (!user) {
        // Create new user with this Omi UID
        const newUser = await storage.createUser({
          username: `omi_${omiUid.slice(0, 8)}`,
          password: omiUid, // Use UID as password for simplicity
        });
        user = await storage.updateUserOmiUid(newUser.id, omiUid);
      }

      res.json({ 
        success: true, 
        user: {
          id: user?.id,
          username: user?.username,
          omiUid: user?.omiUid,
          nativeLanguage: user?.nativeLanguage,
          targetLanguage: user?.targetLanguage,
          streak: user?.streak,
          totalXp: user?.totalXp,
          level: user?.level,
          demoDataEnabled: user?.demoDataEnabled
        }
      });
    } catch (error) {
      console.error("Error logging in with Omi UID:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Get current user profile
  app.get("/api/user/profile", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || DEFAULT_USER_ID;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
        omiUid: user.omiUid,
        nativeLanguage: user.nativeLanguage,
        targetLanguage: user.targetLanguage,
        streak: user.streak,
        totalXp: user.totalXp,
        level: user.level,
        demoDataEnabled: user.demoDataEnabled
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Update user preferences
  app.patch("/api/user/preferences", async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || DEFAULT_USER_ID;
      const { demoDataEnabled, nativeLanguage, targetLanguage } = req.body;
      
      const user = await storage.updateUserPreferences(userId, {
        demoDataEnabled,
        nativeLanguage,
        targetLanguage
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ success: true, user });
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // Reset all user data
  app.post("/api/user/reset", async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || DEFAULT_USER_ID;
      
      await storage.resetUserData(userId);
      
      const user = await storage.getUser(userId);
      res.json({ 
        success: true, 
        message: "All data has been reset",
        user: user ? {
          id: user.id,
          streak: user.streak,
          totalXp: user.totalXp,
          level: user.level
        } : null
      });
    } catch (error) {
      console.error("Error resetting user data:", error);
      res.status(500).json({ error: "Failed to reset data" });
    }
  });

  // ============================================
  // CHALLENGE CHAT ENDPOINTS
  // ============================================

  // Get chat messages
  app.get("/api/chat/messages", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || DEFAULT_USER_ID;
      const challengeId = req.query.challengeId ? parseInt(req.query.challengeId as string) : undefined;
      
      const messages = await storage.getChatMessages(userId, challengeId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send chat message and get Gemini response
  app.post("/api/chat/send", async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || DEFAULT_USER_ID;
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
      console.error("Error sending chat message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Clear chat history
  app.delete("/api/chat/clear", async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || DEFAULT_USER_ID;
      await storage.clearChatMessages(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing chat:", error);
      res.status(500).json({ error: "Failed to clear chat" });
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

  // ============================================
  // VOICE CHALLENGE ENDPOINTS
  // ============================================

  // Get active voice challenge for current user
  app.get("/api/voice-challenges/active", async (req: Request, res: Response) => {
    try {
      const challenge = await storage.getActiveVoiceChallenge(DEFAULT_USER_ID);
      res.json(challenge || null);
    } catch (error) {
      console.error("Error fetching active challenge:", error);
      res.status(500).json({ error: "Failed to fetch active challenge" });
    }
  });

  // Get all voice challenges for current user
  app.get("/api/voice-challenges", async (req: Request, res: Response) => {
    try {
      const challenges = await storage.getVoiceChallenges(DEFAULT_USER_ID);
      res.json(challenges);
    } catch (error) {
      console.error("Error fetching challenges:", error);
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  // Get a specific voice challenge
  app.get("/api/voice-challenges/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const challenge = await storage.getVoiceChallenge(id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      res.json(challenge);
    } catch (error) {
      console.error("Error fetching challenge:", error);
      res.status(500).json({ error: "Failed to fetch challenge" });
    }
  });

  // Generate a new voice challenge
  app.post("/api/voice-challenges/generate", async (req: Request, res: Response) => {
    try {
      const { generateChallengePrompt } = await import("./gemini-challenge");
      
      // Get a random user fact (or use provided one)
      let userFact = await storage.getRandomUserFact(DEFAULT_USER_ID);
      
      // If no facts exist, create some demo ones
      if (!userFact) {
        const demoFacts = [
          { content: "User loves traveling and has visited Japan twice", category: "preference" },
          { content: "User enjoys cooking Italian food on weekends", category: "hobby" },
          { content: "User is learning to play guitar", category: "skill" },
          { content: "User works in software development", category: "work" },
          { content: "User has a golden retriever named Max", category: "personal" },
        ];
        
        for (const fact of demoFacts) {
          await storage.createUserFact({
            userId: DEFAULT_USER_ID,
            content: fact.content,
            category: fact.category,
          });
        }
        userFact = await storage.getRandomUserFact(DEFAULT_USER_ID);
      }

      if (!userFact) {
        return res.status(500).json({ error: "Failed to get user fact" });
      }

      // Generate challenge prompt using Gemini
      const targetLanguage = req.body.targetLanguage || "Spanish";
      const generated = await generateChallengePrompt(userFact, targetLanguage);

      // Create the challenge
      const challenge = await storage.createVoiceChallenge({
        userId: DEFAULT_USER_ID,
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
      console.error("Error generating challenge:", error);
      res.status(500).json({ error: "Failed to generate challenge" });
    }
  });

  // Submit response to a voice challenge
  app.post("/api/voice-challenges/:id/respond", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { transcript, audioUri } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: "Transcript is required" });
      }

      const challenge = await storage.getVoiceChallenge(id);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
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
        for (const correction of feedback.corrections) {
          await storage.createLearningItem({
            userId: DEFAULT_USER_ID,
            originalText: correction.original,
            correctedText: correction.corrected,
            explanation: correction.explanation,
            category: correction.category,
          });
        }
      }

      // Update user XP
      if (completed?.xpEarned) {
        const user = await storage.getUser(DEFAULT_USER_ID);
        if (user) {
          await storage.updateUserStats(DEFAULT_USER_ID, {
            totalXp: (user.totalXp || 0) + completed.xpEarned,
          });
        }
      }

      res.json({
        challenge: completed,
        feedback,
      });
    } catch (error) {
      console.error("Error submitting response:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  // Regenerate/skip a challenge and get a new one
  app.post("/api/voice-challenges/:id/regenerate", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Mark current challenge as skipped
      const existingChallenge = await storage.getVoiceChallenge(id);
      if (existingChallenge) {
        await storage.updateVoiceChallenge(id, { status: "skipped" });
      }

      // Get a different fact (avoid the one just used)
      const facts = await storage.getUserFacts(DEFAULT_USER_ID);
      const availableFacts = facts.filter(f => 
        !existingChallenge?.sourceFactId || f.id.toString() !== existingChallenge.sourceFactId
      );

      if (availableFacts.length === 0) {
        return res.status(400).json({ error: "No alternative facts available" });
      }

      // Pick a random fact from available ones
      const userFact = availableFacts[Math.floor(Math.random() * availableFacts.length)];

      // Generate new challenge
      const { generateChallengePrompt } = await import("./gemini-challenge");
      const targetLanguage = req.body.targetLanguage || "Spanish";
      const generated = await generateChallengePrompt(userFact, targetLanguage);

      const challenge = await storage.createVoiceChallenge({
        userId: DEFAULT_USER_ID,
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
      console.error("Error regenerating challenge:", error);
      res.status(500).json({ error: "Failed to regenerate challenge" });
    }
  });

  // ============================================
  // USER FACTS ENDPOINTS
  // ============================================

  // Get all user facts
  app.get("/api/user-facts", async (req: Request, res: Response) => {
    try {
      const facts = await storage.getUserFacts(DEFAULT_USER_ID);
      res.json(facts);
    } catch (error) {
      console.error("Error fetching user facts:", error);
      res.status(500).json({ error: "Failed to fetch user facts" });
    }
  });

  // Add a user fact manually
  app.post("/api/user-facts", async (req: Request, res: Response) => {
    try {
      const { content, category } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      const fact = await storage.createUserFact({
        userId: DEFAULT_USER_ID,
        content,
        category: category || "general",
      });

      res.status(201).json(fact);
    } catch (error) {
      console.error("Error creating user fact:", error);
      res.status(500).json({ error: "Failed to create user fact" });
    }
  });

  // Sync facts from Omi API (placeholder - requires Omi API key)
  app.post("/api/user-facts/sync-omi", async (req: Request, res: Response) => {
    try {
      // For now, add some demo facts if none exist
      const existingFacts = await storage.getUserFacts(DEFAULT_USER_ID);
      
      if (existingFacts.length === 0) {
        const demoFacts = [
          { content: "User enjoys traveling and has visited 5 countries", category: "hobby" },
          { content: "User prefers coffee over tea, especially espresso", category: "preference" },
          { content: "User is interested in learning new languages", category: "interest" },
          { content: "User works from home as a software developer", category: "work" },
          { content: "User loves watching documentary films", category: "entertainment" },
        ];

        for (const fact of demoFacts) {
          await storage.createUserFact({
            userId: DEFAULT_USER_ID,
            content: fact.content,
            category: fact.category,
          });
        }
      }

      const facts = await storage.getUserFacts(DEFAULT_USER_ID);
      res.json({ synced: facts.length, facts });
    } catch (error) {
      console.error("Error syncing facts from Omi:", error);
      res.status(500).json({ error: "Failed to sync facts" });
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
