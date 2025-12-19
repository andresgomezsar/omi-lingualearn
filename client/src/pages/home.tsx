import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Target, 
  TrendingUp, 
  Zap, 
  Calendar,
  ArrowRight,
  Sparkles,
  BookOpen,
  Mic
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/progress-ring";
import { StatsCard } from "@/components/stats-card";
import { ChallengeCard } from "@/components/challenge-card";
import { WeeklyHeatmap } from "@/components/weekly-heatmap";
import { Skeleton } from "@/components/ui/skeleton";
import type { DailyChallenge, LearningItem } from "@shared/schema";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useQuery<{
    todayCompleted: number;
    todayTotal: number;
    weeklyProgress: number;
    totalItems: number;
    streak: number;
  }>({
    queryKey: ["/api/stats/overview"],
  });

  const { data: challenges, isLoading: challengesLoading } = useQuery<DailyChallenge[]>({
    queryKey: ["/api/challenges/today"],
  });

  const { data: heatmapData } = useQuery<{ date: string; count: number }[]>({
    queryKey: ["/api/stats/weekly"],
  });

  const todayProgress = stats ? (stats.todayCompleted / Math.max(stats.todayTotal, 1)) * 100 : 0;

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-4xl font-bold font-display text-foreground">
          Good morning!
        </h1>
        <p className="text-lg text-muted-foreground">
          Ready to level up your language skills today?
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="relative overflow-visible">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Today's Progress</p>
                  <p className="text-2xl font-bold font-display" data-testid="stat-today-progress">
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      `${stats?.todayCompleted || 0}/${stats?.todayTotal || 5}`
                    )}
                  </p>
                </div>
                <ProgressRing 
                  progress={todayProgress} 
                  size={64} 
                  strokeWidth={6}
                >
                  <span className="text-sm font-bold">{Math.round(todayProgress)}%</span>
                </ProgressRing>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <StatsCard
            title="Weekly Progress"
            value={statsLoading ? "..." : `${stats?.weeklyProgress || 0}%`}
            trend="up"
            trendValue="+12% vs last week"
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatsCard
            title="Learning Items"
            value={statsLoading ? "..." : stats?.totalItems || 0}
            subtitle="Active in your queue"
            icon={<BookOpen className="h-5 w-5" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-gradient-to-br from-primary to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-white/80">XP Earned Today</p>
                  <p className="text-3xl font-bold font-display" data-testid="stat-xp-today">
                    +125
                  </p>
                </div>
                <Sparkles className="h-10 w-10 text-white/80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle className="font-display">Today's Challenges</CardTitle>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/challenges">
                  View all
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {challengesLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-48 w-full rounded-lg" />
                  ))}
                </div>
              ) : challenges && challenges.length > 0 ? (
                challenges.slice(0, 2).map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    id={challenge.id}
                    originalText="I go to school yesterday"
                    correctedText="I went to school yesterday"
                    explanation="Use past tense 'went' instead of present tense 'go' when talking about past events."
                    category="grammar"
                    xpReward={challenge.xpEarned || 25}
                    completed={challenge.completed || false}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mic className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold font-display text-foreground mb-2">
                    No challenges yet
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Start speaking with your Omi necklace to generate personalized language challenges!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="font-display text-lg">This Week</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <WeeklyHeatmap 
                data={heatmapData || [
                  { date: "Mon", count: 5 },
                  { date: "Tue", count: 3 },
                  { date: "Wed", count: 7 },
                  { date: "Thu", count: 2 },
                  { date: "Fri", count: 4 },
                  { date: "Sat", count: 0 },
                  { date: "Sun", count: 1 },
                ]} 
              />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent to-teal-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-display font-semibold">Quick Tip</h3>
                  <p className="text-sm text-white/90">
                    Wear your Omi during daily conversations for the best learning results. The more you speak, the more personalized your challenges become!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
