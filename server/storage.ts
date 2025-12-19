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
  type InsertAchievement
} from "@shared/schema";
import { randomUUID } from "crypto";

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
  private nextItemId: number;
  private nextChallengeId: number;
  private nextAchievementId: number;
  private nextSessionId: number;

  constructor() {
    this.users = new Map();
    this.learningItems = new Map();
    this.sessions = new Map();
    this.dailyChallenges = new Map();
    this.achievements = new Map();
    this.nextItemId = 1;
    this.nextChallengeId = 1;
    this.nextAchievementId = 1;
    this.nextSessionId = 1;
    
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
        ...item,
        id,
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
      ...item,
      id,
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
      ...challenge,
      id,
      completed: false,
      quality: null,
      xpEarned: challenge.xpEarned || 25,
      scheduledFor: challenge.scheduledFor || new Date(),
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
      ...achievement,
      id,
      unlockedAt: new Date(),
    };
    this.achievements.set(id, newAchievement);
    return newAchievement;
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
    return days.map((day, i) => ({
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
