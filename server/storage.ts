import { 
  type User, 
  type InsertUser,
  type LearningItem,
  type InsertLearningItem,
  type Session,
  type InsertSession,
  type DailyChallenge,
  type InsertDailyChallenge,
  type Achievement,
  type InsertAchievement,
  type AudioChunk,
  type InsertAudioChunk,
  type TranscriptSegment,
  type InsertTranscriptSegment,
  type AudioAnalysis,
  type InsertAudioAnalysis,
  type Lesson,
  type InsertLesson
} from "@shared/schema";
import { randomUUID } from "crypto";

// Omi connection type
export interface OmiConnection {
  id: number;
  omiUid: string;
  userId: string;
  appId?: string;
  status: string;
  connectedAt: Date;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStats(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  getLearningItems(userId: string): Promise<LearningItem[]>;
  getLearningItem(id: number): Promise<LearningItem | undefined>;
  createLearningItem(item: InsertLearningItem): Promise<LearningItem>;
  updateLearningItem(id: number, updates: Partial<LearningItem>): Promise<LearningItem | undefined>;
  getDueLearningItems(userId: string): Promise<LearningItem[]>;
  
  getSessions(userId: string): Promise<Session[]>;
  getSession(sessionId: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | undefined>;
  
  getDailyChallenges(userId: string, date?: Date): Promise<DailyChallenge[]>;
  getDailyChallenge(id: number): Promise<DailyChallenge | undefined>;
  createDailyChallenge(challenge: InsertDailyChallenge): Promise<DailyChallenge>;
  completeChallenge(id: number, quality: number): Promise<DailyChallenge | undefined>;
  
  getAchievements(userId: string): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  
  // Omi connection methods
  createOmiConnection(connection: { omiUid: string; userId: string; appId?: string; status: string }): Promise<OmiConnection>;
  getOmiConnection(userId: string): Promise<OmiConnection | undefined>;
  getOmiConnectionByUid(omiUid: string): Promise<OmiConnection | undefined>;
  
  // Audio chunk methods
  createAudioChunk(chunk: InsertAudioChunk): Promise<AudioChunk>;
  getAudioChunks(sessionId: string): Promise<AudioChunk[]>;
  getAudioChunk(id: number): Promise<AudioChunk | undefined>;
  
  // Transcript segment methods
  createTranscriptSegment(segment: InsertTranscriptSegment): Promise<TranscriptSegment>;
  getTranscriptSegments(sessionId: string): Promise<TranscriptSegment[]>;
  
  // Audio analysis methods
  createAudioAnalysis(analysis: InsertAudioAnalysis): Promise<AudioAnalysis>;
  getAudioAnalysis(sessionId: string): Promise<AudioAnalysis | undefined>;
  updateAudioAnalysis(id: number, updates: Partial<AudioAnalysis>): Promise<AudioAnalysis | undefined>;
  
  // Lesson methods
  createLesson(lesson: InsertLesson): Promise<Lesson>;
  getLessons(userId: string): Promise<Lesson[]>;
  getLesson(id: number): Promise<Lesson | undefined>;
  completeLesson(id: number): Promise<Lesson | undefined>;
  
  getOverviewStats(userId: string): Promise<{
    todayCompleted: number;
    todayTotal: number;
    weeklyProgress: number;
    totalItems: number;
    streak: number;
  }>;
  getWeeklyStats(userId: string): Promise<{ date: string; count: number }[]>;
  getProgressStats(userId: string): Promise<{
    totalChallenges: number;
    completedChallenges: number;
    accuracy: number;
    weeklyStreak: number;
    averageDaily: number;
    cefrLevel: string;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private learningItems: Map<number, LearningItem>;
  private sessions: Map<string, Session>;
  private dailyChallenges: Map<number, DailyChallenge>;
  private achievements: Map<number, Achievement>;
  private omiConnections: Map<string, OmiConnection>;
  private audioChunks: Map<number, AudioChunk>;
  private transcriptSegments: Map<number, TranscriptSegment>;
  private audioAnalyses: Map<number, AudioAnalysis>;
  private lessons: Map<number, Lesson>;
  
  private nextItemId: number;
  private nextChallengeId: number;
  private nextAchievementId: number;
  private nextSessionId: number;
  private nextOmiConnectionId: number;
  private nextAudioChunkId: number;
  private nextTranscriptSegmentId: number;
  private nextAudioAnalysisId: number;
  private nextLessonId: number;

  constructor() {
    this.users = new Map();
    this.learningItems = new Map();
    this.sessions = new Map();
    this.dailyChallenges = new Map();
    this.achievements = new Map();
    this.omiConnections = new Map();
    this.audioChunks = new Map();
    this.transcriptSegments = new Map();
    this.audioAnalyses = new Map();
    this.lessons = new Map();
    
    this.nextItemId = 1;
    this.nextChallengeId = 1;
    this.nextAchievementId = 1;
    this.nextSessionId = 1;
    this.nextOmiConnectionId = 1;
    this.nextAudioChunkId = 1;
    this.nextTranscriptSegmentId = 1;
    this.nextAudioAnalysisId = 1;
    this.nextLessonId = 1;
    
    this.initializeDemoData();
  }

  private initializeDemoData() {
    const demoUserId = "demo-user";
    this.users.set(demoUserId, {
      id: demoUserId,
      username: "demo",
      password: "demo",
      nativeLanguage: "English",
      targetLanguage: "Spanish",
      streak: 7,
      totalXp: 1250,
      level: 3,
      createdAt: new Date(),
    });

    const demoItems: InsertLearningItem[] = [
      {
        userId: demoUserId,
        sessionId: "session-1",
        originalText: "I go to school yesterday",
        correctedText: "I went to school yesterday",
        explanation: "Use past tense 'went' instead of present tense 'go' when talking about past events.",
        category: "grammar",
      },
      {
        userId: demoUserId,
        sessionId: "session-1",
        originalText: "She don't like pizza",
        correctedText: "She doesn't like pizza",
        explanation: "Third person singular (he/she/it) requires 'doesn't' instead of 'don't'.",
        category: "grammar",
      },
      {
        userId: demoUserId,
        sessionId: "session-2",
        originalText: "I'm very agree with you",
        correctedText: "I strongly agree with you",
        explanation: "Use 'strongly' or 'completely' with 'agree', not 'very'.",
        category: "vocabulary",
      },
    ];

    demoItems.forEach((item, index) => {
      const id = this.nextItemId++;
      this.learningItems.set(id, {
        id,
        userId: item.userId,
        sessionId: item.sessionId ?? null,
        originalText: item.originalText,
        correctedText: item.correctedText,
        explanation: item.explanation,
        category: item.category ?? null,
        easeFactor: 2.5,
        interval: index === 0 ? 0 : index * 2,
        repetitions: index,
        dueDate: new Date(Date.now() + index * 86400000),
        lastReviewed: index > 0 ? new Date(Date.now() - 86400000) : null,
        createdAt: new Date(Date.now() - (3 - index) * 86400000),
      });
    });

    const demoChallenges = [
      { challengeText: "Practice: I went to school yesterday", learningItemId: 1, xpEarned: 25 },
      { challengeText: "Practice: She doesn't like pizza", learningItemId: 2, xpEarned: 25 },
      { challengeText: "Practice: I strongly agree with you", learningItemId: 3, xpEarned: 30 },
      { challengeText: "Practice: The information is correct", completed: true, xpEarned: 25 },
      { challengeText: "Practice: I have been studying for two hours", completed: true, xpEarned: 30 },
    ];

    demoChallenges.forEach((challenge) => {
      const id = this.nextChallengeId++;
      this.dailyChallenges.set(id, {
        id,
        userId: demoUserId,
        learningItemId: challenge.learningItemId || null,
        challengeText: challenge.challengeText,
        completed: challenge.completed || false,
        quality: challenge.completed ? 5 : null,
        xpEarned: challenge.xpEarned,
        scheduledFor: new Date(),
        completedAt: challenge.completed ? new Date() : null,
        createdAt: new Date(),
      });
    });

    const demoAchievements = [
      { type: "first_challenge", title: "First Steps", description: "Complete your first challenge", icon: "target" },
      { type: "streak_3", title: "On Fire", description: "3-day streak", icon: "flame" },
      { type: "streak_7", title: "Week Warrior", description: "7-day streak", icon: "flame" },
      { type: "challenges_10", title: "Dedicated Learner", description: "Complete 10 challenges", icon: "check" },
      { type: "challenges_50", title: "Challenge Champion", description: "Complete 50 challenges", icon: "trophy" },
      { type: "grammar_master", title: "Grammar Guru", description: "Master 20 grammar items", icon: "book" },
      { type: "first_session", title: "Omi Connected", description: "Complete first Omi session", icon: "mic" },
    ];

    demoAchievements.forEach((achievement) => {
      const id = this.nextAchievementId++;
      this.achievements.set(id, {
        id,
        userId: demoUserId,
        type: achievement.type,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        unlockedAt: new Date(Date.now() - Math.random() * 7 * 86400000),
      });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      nativeLanguage: "English",
      targetLanguage: "Spanish",
      streak: 0,
      totalXp: 0,
      level: 1,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserStats(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async getLearningItems(userId: string): Promise<LearningItem[]> {
    return Array.from(this.learningItems.values())
      .filter((item) => item.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getLearningItem(id: number): Promise<LearningItem | undefined> {
    return this.learningItems.get(id);
  }

  async createLearningItem(item: InsertLearningItem): Promise<LearningItem> {
    const id = this.nextItemId++;
    const learningItem: LearningItem = {
      id,
      userId: item.userId,
      sessionId: item.sessionId ?? null,
      originalText: item.originalText,
      correctedText: item.correctedText,
      explanation: item.explanation,
      category: item.category ?? null,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      dueDate: new Date(),
      lastReviewed: null,
      createdAt: new Date(),
    };
    this.learningItems.set(id, learningItem);
    return learningItem;
  }

  async updateLearningItem(id: number, updates: Partial<LearningItem>): Promise<LearningItem | undefined> {
    const item = this.learningItems.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...updates };
    this.learningItems.set(id, updated);
    return updated;
  }

  async getDueLearningItems(userId: string): Promise<LearningItem[]> {
    const now = new Date();
    return Array.from(this.learningItems.values())
      .filter((item) => item.userId === userId && (!item.dueDate || new Date(item.dueDate) <= now));
  }

  async getSessions(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values())
      .filter((session) => session.userId === userId);
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId);
  }

  async createSession(session: InsertSession): Promise<Session> {
    const id = this.nextSessionId++;
    const newSession: Session = {
      ...session,
      id,
      startTime: new Date(),
      endTime: null,
      durationSeconds: 0,
      wordsSpoken: 0,
      issuesFound: 0,
      cefrLevel: null,
      fluencyScore: null,
      createdAt: new Date(),
    };
    this.sessions.set(session.sessionId, newSession);
    return newSession;
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  async getDailyChallenges(userId: string, date?: Date): Promise<DailyChallenge[]> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.dailyChallenges.values())
      .filter((challenge) => {
        if (challenge.userId !== userId) return false;
        const scheduledFor = challenge.scheduledFor ? new Date(challenge.scheduledFor) : null;
        if (!scheduledFor) return false;
        return scheduledFor >= startOfDay && scheduledFor <= endOfDay;
      });
  }

  async getDailyChallenge(id: number): Promise<DailyChallenge | undefined> {
    return this.dailyChallenges.get(id);
  }

  async createDailyChallenge(challenge: InsertDailyChallenge): Promise<DailyChallenge> {
    const id = this.nextChallengeId++;
    const newChallenge: DailyChallenge = {
      id,
      userId: challenge.userId,
      learningItemId: challenge.learningItemId ?? null,
      challengeText: challenge.challengeText,
      completed: false,
      quality: null,
      xpEarned: challenge.xpEarned ?? 25,
      scheduledFor: challenge.scheduledFor ?? new Date(),
      completedAt: null,
      createdAt: new Date(),
    };
    this.dailyChallenges.set(id, newChallenge);
    return newChallenge;
  }

  async completeChallenge(id: number, quality: number): Promise<DailyChallenge | undefined> {
    const challenge = this.dailyChallenges.get(id);
    if (!challenge) return undefined;
    
    const updated: DailyChallenge = {
      ...challenge,
      completed: true,
      quality,
      completedAt: new Date(),
    };
    this.dailyChallenges.set(id, updated);

    if (challenge.learningItemId) {
      const item = await this.getLearningItem(challenge.learningItemId);
      if (item) {
        const sm2Update = this.calculateSM2(item, quality);
        await this.updateLearningItem(challenge.learningItemId, sm2Update);
      }
    }

    return updated;
  }

  private calculateSM2(item: LearningItem, quality: number): Partial<LearningItem> {
    let { easeFactor, interval, repetitions } = item;
    easeFactor = easeFactor || 2.5;
    interval = interval || 0;
    repetitions = repetitions || 0;

    if (quality < 3) {
      repetitions = 0;
      interval = 1;
    } else {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    }

    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + interval);

    return {
      easeFactor,
      interval,
      repetitions,
      dueDate,
      lastReviewed: new Date(),
    };
  }

  async getAchievements(userId: string): Promise<Achievement[]> {
    return Array.from(this.achievements.values())
      .filter((achievement) => achievement.userId === userId)
      .sort((a, b) => (b.unlockedAt?.getTime() || 0) - (a.unlockedAt?.getTime() || 0));
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const id = this.nextAchievementId++;
    const newAchievement: Achievement = {
      id,
      userId: achievement.userId,
      type: achievement.type,
      title: achievement.title,
      description: achievement.description ?? null,
      icon: achievement.icon ?? null,
      unlockedAt: new Date(),
    };
    this.achievements.set(id, newAchievement);
    return newAchievement;
  }

  async createOmiConnection(connection: { omiUid: string; userId: string; appId?: string; status: string }): Promise<OmiConnection> {
    const id = this.nextOmiConnectionId++;
    const newConnection: OmiConnection = {
      id,
      omiUid: connection.omiUid,
      userId: connection.userId,
      appId: connection.appId,
      status: connection.status,
      connectedAt: new Date(),
    };
    this.omiConnections.set(connection.userId, newConnection);
    return newConnection;
  }

  async getOmiConnection(userId: string): Promise<OmiConnection | undefined> {
    return this.omiConnections.get(userId);
  }

  async getOmiConnectionByUid(omiUid: string): Promise<OmiConnection | undefined> {
    return Array.from(this.omiConnections.values()).find(c => c.omiUid === omiUid);
  }

  // Audio chunk methods
  async createAudioChunk(chunk: InsertAudioChunk): Promise<AudioChunk> {
    const id = this.nextAudioChunkId++;
    const newChunk: AudioChunk = {
      id,
      sessionId: chunk.sessionId,
      userId: chunk.userId,
      gcpUri: chunk.gcpUri,
      startMs: chunk.startMs ?? null,
      endMs: chunk.endMs ?? null,
      sampleRate: chunk.sampleRate ?? 16000,
      durationMs: chunk.durationMs ?? null,
      chunkIndex: chunk.chunkIndex ?? 0,
      createdAt: new Date(),
    };
    this.audioChunks.set(id, newChunk);
    return newChunk;
  }

  async getAudioChunks(sessionId: string): Promise<AudioChunk[]> {
    return Array.from(this.audioChunks.values())
      .filter((chunk) => chunk.sessionId === sessionId)
      .sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
  }

  async getAudioChunk(id: number): Promise<AudioChunk | undefined> {
    return this.audioChunks.get(id);
  }

  // Transcript segment methods
  async createTranscriptSegment(segment: InsertTranscriptSegment): Promise<TranscriptSegment> {
    const id = this.nextTranscriptSegmentId++;
    const newSegment: TranscriptSegment = {
      id,
      sessionId: segment.sessionId,
      userId: segment.userId,
      text: segment.text,
      speaker: segment.speaker ?? null,
      speakerId: segment.speakerId ?? null,
      isUser: segment.isUser ?? false,
      startMs: segment.startMs ?? null,
      endMs: segment.endMs ?? null,
      confidence: segment.confidence ?? null,
      createdAt: new Date(),
    };
    this.transcriptSegments.set(id, newSegment);
    return newSegment;
  }

  async getTranscriptSegments(sessionId: string): Promise<TranscriptSegment[]> {
    return Array.from(this.transcriptSegments.values())
      .filter((segment) => segment.sessionId === sessionId)
      .sort((a, b) => (a.startMs || 0) - (b.startMs || 0));
  }

  // Audio analysis methods
  async createAudioAnalysis(analysis: InsertAudioAnalysis): Promise<AudioAnalysis> {
    const id = this.nextAudioAnalysisId++;
    const newAnalysis: AudioAnalysis = {
      id,
      sessionId: analysis.sessionId,
      userId: analysis.userId,
      compiledAudioUri: analysis.compiledAudioUri ?? null,
      transcriptText: analysis.transcriptText ?? null,
      pronunciationScore: analysis.pronunciationScore ?? null,
      fluencyScore: analysis.fluencyScore ?? null,
      accuracyScore: analysis.accuracyScore ?? null,
      overallScore: analysis.overallScore ?? null,
      analysisJson: analysis.analysisJson ?? null,
      status: analysis.status ?? "pending",
      geminiRequestId: analysis.geminiRequestId ?? null,
      createdAt: new Date(),
      completedAt: null,
    };
    this.audioAnalyses.set(id, newAnalysis);
    return newAnalysis;
  }

  async getAudioAnalysis(sessionId: string): Promise<AudioAnalysis | undefined> {
    return Array.from(this.audioAnalyses.values()).find(a => a.sessionId === sessionId);
  }

  async updateAudioAnalysis(id: number, updates: Partial<AudioAnalysis>): Promise<AudioAnalysis | undefined> {
    const analysis = this.audioAnalyses.get(id);
    if (!analysis) return undefined;
    const updated = { ...analysis, ...updates };
    this.audioAnalyses.set(id, updated);
    return updated;
  }

  // Lesson methods
  async createLesson(lesson: InsertLesson): Promise<Lesson> {
    const id = this.nextLessonId++;
    const newLesson: Lesson = {
      id,
      userId: lesson.userId,
      sessionId: lesson.sessionId ?? null,
      analysisId: lesson.analysisId ?? null,
      lessonType: lesson.lessonType,
      title: lesson.title,
      content: lesson.content,
      audioReferences: lesson.audioReferences ?? null,
      difficulty: lesson.difficulty ?? "intermediate",
      xpReward: lesson.xpReward ?? 50,
      completed: false,
      createdAt: new Date(),
      completedAt: null,
    };
    this.lessons.set(id, newLesson);
    return newLesson;
  }

  async getLessons(userId: string): Promise<Lesson[]> {
    return Array.from(this.lessons.values())
      .filter((lesson) => lesson.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async getLesson(id: number): Promise<Lesson | undefined> {
    return this.lessons.get(id);
  }

  async completeLesson(id: number): Promise<Lesson | undefined> {
    const lesson = this.lessons.get(id);
    if (!lesson) return undefined;
    const updated = { ...lesson, completed: true, completedAt: new Date() };
    this.lessons.set(id, updated);
    return updated;
  }

  async getOverviewStats(userId: string): Promise<{
    todayCompleted: number;
    todayTotal: number;
    weeklyProgress: number;
    totalItems: number;
    streak: number;
  }> {
    const user = await this.getUser(userId);
    const todayChallenges = await this.getDailyChallenges(userId);
    const items = await this.getLearningItems(userId);

    return {
      todayCompleted: todayChallenges.filter(c => c.completed).length,
      todayTotal: todayChallenges.length || 5,
      weeklyProgress: 72,
      totalItems: items.length,
      streak: user?.streak || 0,
    };
  }

  async getWeeklyStats(userId: string): Promise<{ date: string; count: number }[]> {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((day) => ({
      date: day,
      count: Math.floor(Math.random() * 8),
    }));
  }

  async getProgressStats(userId: string): Promise<{
    totalChallenges: number;
    completedChallenges: number;
    accuracy: number;
    weeklyStreak: number;
    averageDaily: number;
    cefrLevel: string;
  }> {
    const allChallenges = Array.from(this.dailyChallenges.values())
      .filter(c => c.userId === userId);
    const completed = allChallenges.filter(c => c.completed);

    return {
      totalChallenges: allChallenges.length,
      completedChallenges: completed.length,
      accuracy: 91,
      weeklyStreak: 5,
      averageDaily: 4.2,
      cefrLevel: "B1",
    };
  }
}

export const storage = new MemStorage();
