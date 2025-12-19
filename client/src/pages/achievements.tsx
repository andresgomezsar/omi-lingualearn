import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Trophy, 
  Flame, 
  Target, 
  BookOpen, 
  Zap, 
  Star,
  Calendar,
  Mic,
  CheckCircle2,
  Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AchievementBadge } from "@/components/achievement-badge";
import type { Achievement } from "@shared/schema";

const achievementDefinitions = [
  { type: "first_challenge", title: "First Steps", description: "Complete your first challenge", icon: <Target className="h-6 w-6" />, unlocked: true },
  { type: "streak_3", title: "On Fire", description: "3-day streak", icon: <Flame className="h-6 w-6" />, unlocked: true },
  { type: "streak_7", title: "Week Warrior", description: "7-day streak", icon: <Flame className="h-6 w-6" />, unlocked: true },
  { type: "streak_30", title: "Monthly Master", description: "30-day streak", icon: <Calendar className="h-6 w-6" />, unlocked: false },
  { type: "challenges_10", title: "Dedicated Learner", description: "Complete 10 challenges", icon: <CheckCircle2 className="h-6 w-6" />, unlocked: true },
  { type: "challenges_50", title: "Challenge Champion", description: "Complete 50 challenges", icon: <Trophy className="h-6 w-6" />, unlocked: true },
  { type: "challenges_100", title: "Century Club", description: "Complete 100 challenges", icon: <Award className="h-6 w-6" />, unlocked: false },
  { type: "perfect_week", title: "Perfect Week", description: "100% accuracy for a week", icon: <Star className="h-6 w-6" />, unlocked: false },
  { type: "grammar_master", title: "Grammar Guru", description: "Master 20 grammar items", icon: <BookOpen className="h-6 w-6" />, unlocked: true },
  { type: "vocab_master", title: "Word Wizard", description: "Master 30 vocabulary items", icon: <Zap className="h-6 w-6" />, unlocked: false },
  { type: "first_session", title: "Omi Connected", description: "Complete first Omi session", icon: <Mic className="h-6 w-6" />, unlocked: true },
  { type: "hours_5", title: "Time Traveler", description: "5 hours of practice", icon: <Calendar className="h-6 w-6" />, unlocked: false },
];

export default function Achievements() {
  const { data: achievements, isLoading } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
  });

  const unlockedCount = achievementDefinitions.filter(a => a.unlocked).length;
  const totalCount = achievementDefinitions.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center">
          <Trophy className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">
            Achievements
          </h1>
          <p className="text-muted-foreground">
            {unlockedCount} of {totalCount} unlocked ({progressPercent}%)
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-r from-primary/10 via-teal-500/10 to-accent/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center text-white">
                <Trophy className="h-10 w-10" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold font-display text-foreground mb-2">
                  Achievement Hunter
                </h3>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-teal-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {totalCount - unlockedCount} more achievements to unlock
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="font-display">All Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {achievementDefinitions.map((achievement, index) => (
                <motion.div
                  key={achievement.type}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <AchievementBadge
                    title={achievement.title}
                    description={achievement.description}
                    icon={achievement.icon}
                    unlocked={achievement.unlocked}
                  />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Recent Unlocks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {achievementDefinitions
                .filter(a => a.unlocked)
                .slice(0, 3)
                .map((achievement, index) => (
                  <motion.div
                    key={achievement.type}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/50"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center text-white">
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{achievement.title}</h4>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">Today</span>
                  </motion.div>
                ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
