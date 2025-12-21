import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Zap, 
  Calendar,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/progress-ring";
import { StatsCard } from "@/components/stats-card";
import { VoiceChallengeCard } from "@/components/voice-challenge-card";
import { WeeklyHeatmap } from "@/components/weekly-heatmap";
import { Skeleton } from "@/components/ui/skeleton";

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
          <Card className="bg-gradient-to-br from-primary to-teal-600 text-white">
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
          <VoiceChallengeCard />
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
