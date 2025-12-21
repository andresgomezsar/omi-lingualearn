import { pgTable, text, varchar, integer, real, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  omiUid: varchar("omi_uid").unique(), // Omi device UID for authentication
  nativeLanguage: text("native_language").default("English"),
  targetLanguage: text("target_language").default("Spanish"),
  streak: integer("streak").default(0),
  totalXp: integer("total_xp").default(0),
  level: integer("level").default(1),
  demoDataEnabled: boolean("demo_data_enabled").default(true), // Toggle for demo data
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const learningItems = pgTable("learning_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  sessionId: varchar("session_id"),
  originalText: text("original_text").notNull(),
  correctedText: text("corrected_text").notNull(),
  explanation: text("explanation").notNull(),
  category: text("category").default("grammar"),
  easeFactor: real("ease_factor").default(2.5),
  interval: integer("interval").default(0),
  repetitions: integer("repetitions").default(0),
  dueDate: timestamp("due_date").default(sql`CURRENT_TIMESTAMP`),
  lastReviewed: timestamp("last_reviewed"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id").notNull().unique(),
  userId: varchar("user_id").notNull(),
  startTime: timestamp("start_time").default(sql`CURRENT_TIMESTAMP`),
  endTime: timestamp("end_time"),
  durationSeconds: integer("duration_seconds").default(0),
  wordsSpoken: integer("words_spoken").default(0),
  issuesFound: integer("issues_found").default(0),
  cefrLevel: text("cefr_level"),
  fluencyScore: integer("fluency_score"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const dailyChallenges = pgTable("daily_challenges", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  learningItemId: integer("learning_item_id"),
  challengeText: text("challenge_text").notNull(),
  completed: boolean("completed").default(false),
  quality: integer("quality"),
  xpEarned: integer("xp_earned").default(0),
  scheduledFor: timestamp("scheduled_for").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"),
  unlockedAt: timestamp("unlocked_at").default(sql`CURRENT_TIMESTAMP`),
});

// Audio chunks received from Omi - stored in GCP bucket
export const audioChunks = pgTable("audio_chunks", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  gcpUri: text("gcp_uri").notNull(),
  startMs: integer("start_ms"),
  endMs: integer("end_ms"),
  sampleRate: integer("sample_rate").default(16000),
  durationMs: integer("duration_ms"),
  chunkIndex: integer("chunk_index").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Transcript segments with timing metadata for audio correlation
export const transcriptSegments = pgTable("transcript_segments", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  text: text("text").notNull(),
  speaker: text("speaker"),
  speakerId: integer("speaker_id"),
  isUser: boolean("is_user").default(false),
  startMs: real("start_ms"),
  endMs: real("end_ms"),
  confidence: real("confidence"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Audio analysis results from Gemini
export const audioAnalyses = pgTable("audio_analyses", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  compiledAudioUri: text("compiled_audio_uri"),
  transcriptText: text("transcript_text"),
  pronunciationScore: integer("pronunciation_score"),
  fluencyScore: integer("fluency_score"),
  accuracyScore: integer("accuracy_score"),
  overallScore: integer("overall_score"),
  analysisJson: text("analysis_json"),
  status: text("status").default("pending"),
  geminiRequestId: text("gemini_request_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
});

// Compiled WAV files with timestamps for transcript matching
export const compiledAudioFiles = pgTable("compiled_audio_files", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  gcpUri: text("gcp_uri").notNull(),
  startTimestamp: timestamp("start_timestamp").notNull(),
  endTimestamp: timestamp("end_timestamp").notNull(),
  durationMs: integer("duration_ms").notNull(),
  sampleRate: integer("sample_rate").default(16000),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Voice Coach Challenges - personalized language practice prompts
export const voiceChallenges = pgTable("voice_challenges", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  status: text("status").default("pending"), // pending, active, completed, expired
  // Source fact from Omi
  sourceFact: text("source_fact"),
  sourceFactId: varchar("source_fact_id"),
  // Generated prompt
  prompt: text("prompt").notNull(),
  languageGoal: text("language_goal"), // e.g., "past tense conjugation", "subjunctive mood"
  targetLanguage: text("target_language").default("Spanish"),
  difficulty: text("difficulty").default("intermediate"),
  // User response
  responseTranscript: text("response_transcript"),
  responseAudioUri: text("response_audio_uri"),
  respondedAt: timestamp("responded_at"),
  // Gemini feedback
  feedbackJson: text("feedback_json"), // Full analysis from Gemini
  grammarScore: integer("grammar_score"),
  vocabularyScore: integer("vocabulary_score"),
  pronunciationScore: integer("pronunciation_score"),
  overallScore: integer("overall_score"),
  corrections: text("corrections"), // JSON array of corrections
  // Rewards
  xpEarned: integer("xp_earned").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
});

// User facts from Omi (cached)
export const userFacts = pgTable("user_facts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  omiFactId: varchar("omi_fact_id"),
  category: text("category"), // preference, memory, habit, etc.
  content: text("content").notNull(),
  lastUsed: timestamp("last_used"),
  useCount: integer("use_count").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Challenge chat messages for discussing challenges with Gemini
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  challengeId: integer("challenge_id"), // Optional reference to active challenge
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  contextJson: text("context_json"), // Challenge/transcript context sent with this message
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Generated lessons from audio analysis
export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  sessionId: varchar("session_id"),
  analysisId: integer("analysis_id"),
  lessonType: text("lesson_type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  audioReferences: text("audio_references"),
  difficulty: text("difficulty").default("intermediate"),
  xpReward: integer("xp_reward").default(50),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertLearningItemSchema = createInsertSchema(learningItems).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export const insertDailyChallengeSchema = createInsertSchema(dailyChallenges).omit({
  id: true,
  createdAt: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  unlockedAt: true,
});

export const insertAudioChunkSchema = createInsertSchema(audioChunks).omit({
  id: true,
  createdAt: true,
});

export const insertTranscriptSegmentSchema = createInsertSchema(transcriptSegments).omit({
  id: true,
  createdAt: true,
});

export const insertAudioAnalysisSchema = createInsertSchema(audioAnalyses).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertLessonSchema = createInsertSchema(lessons).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertCompiledAudioFileSchema = createInsertSchema(compiledAudioFiles).omit({
  id: true,
  createdAt: true,
});

export const insertVoiceChallengeSchema = createInsertSchema(voiceChallenges).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertUserFactSchema = createInsertSchema(userFacts).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LearningItem = typeof learningItems.$inferSelect;
export type InsertLearningItem = z.infer<typeof insertLearningItemSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type DailyChallenge = typeof dailyChallenges.$inferSelect;
export type InsertDailyChallenge = z.infer<typeof insertDailyChallengeSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type AudioChunk = typeof audioChunks.$inferSelect;
export type InsertAudioChunk = z.infer<typeof insertAudioChunkSchema>;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type InsertTranscriptSegment = z.infer<typeof insertTranscriptSegmentSchema>;
export type AudioAnalysis = typeof audioAnalyses.$inferSelect;
export type InsertAudioAnalysis = z.infer<typeof insertAudioAnalysisSchema>;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type CompiledAudioFile = typeof compiledAudioFiles.$inferSelect;
export type InsertCompiledAudioFile = z.infer<typeof insertCompiledAudioFileSchema>;
export type VoiceChallenge = typeof voiceChallenges.$inferSelect;
export type InsertVoiceChallenge = z.infer<typeof insertVoiceChallengeSchema>;
export type UserFact = typeof userFacts.$inferSelect;
export type InsertUserFact = z.infer<typeof insertUserFactSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
