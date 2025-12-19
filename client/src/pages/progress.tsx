import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Target, Calendar, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/progress-ring";
import { StatsCard } from "@/components/stats-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProgressPage() {
  const { data: stats, isLoading } = useQuery<{
    totalChallenges: number;
    completedChallenges: number;
    accuracy: number;
    weeklyStreak: number;
    averageDaily: number;
    cefrLevel: string;
  }>({
    queryKey: ["/api/stats/progress"],
  });

  const displayStats = stats || {
    totalChallenges: 156,
    completedChallenges: 142,
    accuracy: 91,
    weeklyStreak: 5,
    averageDaily: 4.2,
    cefrLevel: "B1",
  };

  const completionRate = Math.round((displayStats.completedChallenges / Math.max(displayStats.totalChallenges, 1)) * 100);

  const weeklyData = [
    { day: "Mon", value: 85 },
    { day: "Tue", value: 72 },
    { day: "Wed", value: 90 },
    { day: "Thu", value: 65 },
    { day: "Fri", value: 78 },
    { day: "Sat", value: 45 },
    { day: "Sun", value: 60 },
  ];

  const categoryBreakdown = [
    { category: "Grammar", progress: 78, color: "bg-primary" },
    { category: "Vocabulary", progress: 65, color: "bg-accent" },
    { category: "Pronunciation", progress: 52, color: "bg-secondary" },
  ];

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">
            Your Progress
          </h1>
          <p className="text-muted-foreground">
            Track your language learning journey
          </p>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatsCard
            title="Completion Rate"
            value={`${completionRate}%`}
            trend="up"
            trendValue="+5% this week"
            icon={<Target className="h-5 w-5" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <StatsCard
            title="Accuracy"
            value={`${displayStats.accuracy}%`}
            trend="up"
            trendValue="+3% vs last month"
            icon={<Award className="h-5 w-5" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatsCard
            title="Weekly Streak"
            value={`${displayStats.weeklyStreak} weeks`}
            subtitle="Keep it going!"
            icon={<Calendar className="h-5 w-5" />}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-gradient-to-br from-primary to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-white/80 mb-1">Current Level</p>
                <p className="text-4xl font-bold font-display" data-testid="text-cefr-level">
                  {displayStats.cefrLevel}
                </p>
                <p className="text-xs text-white/70 mt-1">CEFR Scale</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Weekly Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-2 h-40">
                {weeklyData.map((day, index) => (
                  <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                    <motion.div
                      className="w-full bg-primary rounded-t-md"
                      initial={{ height: 0 }}
                      animate={{ height: `${day.value}%` }}
                      transition={{ delay: 0.4 + index * 0.05, duration: 0.5 }}
                    />
                    <span className="text-xs text-muted-foreground">{day.day}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {categoryBreakdown.map((cat, index) => (
                <div key={cat.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{cat.category}</span>
                    <span className="text-sm text-muted-foreground">{cat.progress}%</span>
                  </div>
                  <motion.div
                    className="h-2 bg-muted rounded-full overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <motion.div
                      className={`h-full ${cat.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.progress}%` }}
                      transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                    />
                  </motion.div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Overall Mastery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center justify-around gap-8 py-4">
              <div className="text-center">
                <ProgressRing progress={completionRate} size={140} strokeWidth={10}>
                  <div className="text-center">
                    <span className="text-3xl font-bold font-display">{completionRate}%</span>
                    <p className="text-xs text-muted-foreground">Complete</p>
                  </div>
                </ProgressRing>
                <p className="mt-4 text-sm text-muted-foreground">
                  {displayStats.completedChallenges} of {displayStats.totalChallenges} challenges
                </p>
              </div>

              <div className="space-y-4 text-center md:text-left">
                <div>
                  <p className="text-sm text-muted-foreground">Daily Average</p>
                  <p className="text-2xl font-bold font-display">{displayStats.averageDaily} challenges</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Best Day</p>
                  <p className="text-2xl font-bold font-display">12 challenges</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Learning Time</p>
                  <p className="text-2xl font-bold font-display">24h 35m</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
