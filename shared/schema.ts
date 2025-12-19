import { pgTable, text, varchar, integer, real, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  nativeLanguage: text("native_language").default("English"),
  targetLanguage: text("target_language").default("Spanish"),
  streak: integer("streak").default(0),
  totalXp: integer("total_xp").default(0),
  level: integer("level").default(1),
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
