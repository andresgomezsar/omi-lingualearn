import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Target, Filter, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChallengeCard } from "@/components/challenge-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DailyChallenge } from "@shared/schema";

interface ChallengeDisplay {
  id: number;
  originalText: string;
  correctedText: string;
  explanation: string;
  category: string;
  xpEarned: number;
  completed: boolean;
}

function convertChallenge(challenge: DailyChallenge): ChallengeDisplay {
  return {
    id: challenge.id,
    originalText: "Practice the following phrase",
    correctedText: challenge.challengeText,
    explanation: "Complete this challenge to earn XP!",
    category: "grammar",
    xpEarned: challenge.xpEarned || 25,
    completed: challenge.completed || false,
  };
}

export default function Challenges() {
  const { toast } = useToast();

  const { data: challenges, isLoading } = useQuery<DailyChallenge[]>({
    queryKey: ["/api/challenges/today"],
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, quality }: { id: number; quality: number }) => {
      return apiRequest("PATCH", `/api/challenges/${id}/complete`, { quality });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      toast({
        title: "Challenge completed!",
        description: "Your review has been recorded",
      });
    },
  });

  const displayChallenges: ChallengeDisplay[] = challenges 
    ? challenges.map(convertChallenge) 
    : [];
  const pendingChallenges = displayChallenges.filter(c => !c.completed);
  const completedChallenges = displayChallenges.filter(c => c.completed);

  const handleComplete = (id: number, quality: number) => {
    completeMutation.mutate({ id, quality });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 flex-wrap"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display text-foreground">
              Today's Challenges
            </h1>
            <p className="text-muted-foreground">
              {pendingChallenges.length} challenges remaining · Personalized from your Omi memories
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </motion.div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingChallenges.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Completed ({completedChallenges.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56 w-full rounded-lg" />
              ))}
            </div>
          ) : pendingChallenges.length > 0 ? (
            pendingChallenges.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ChallengeCard
                  id={challenge.id}
                  originalText={challenge.originalText || "I go to school yesterday"}
                  correctedText={challenge.correctedText || "I went to school yesterday"}
                  explanation={challenge.explanation || "Use past tense for past events."}
                  category={challenge.category || "grammar"}
                  xpReward={challenge.xpEarned || 25}
                  completed={false}
                  onComplete={handleComplete}
                />
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold font-display text-foreground mb-2">
                All done!
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                You've completed all of today's challenges. Great work! Come back tomorrow for more practice.
              </p>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedChallenges.length > 0 ? (
            completedChallenges.map((challenge, index) => (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ChallengeCard
                  id={challenge.id}
                  originalText={challenge.originalText || "The informations are correct"}
                  correctedText={challenge.correctedText || "The information is correct"}
                  explanation={challenge.explanation || "Information is uncountable."}
                  category={challenge.category || "grammar"}
                  xpReward={challenge.xpEarned || 25}
                  completed={true}
                />
              </motion.div>
            ))
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              No completed challenges yet
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
