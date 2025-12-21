import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, 
  Target, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  MessageSquare,
  BookOpen,
  Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VoiceChallenge } from "@shared/schema";

interface VoiceChallengeCardProps {
  expanded?: boolean;
}

export function VoiceChallengeCard({ expanded = false }: VoiceChallengeCardProps) {
  const { toast } = useToast();
  const [showFeedback, setShowFeedback] = useState(false);

  const { data: activeChallenge, isLoading } = useQuery<VoiceChallenge | null>({
    queryKey: ["/api/voice-challenges/active"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/voice-challenges/generate", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-challenges/active"] });
      toast({
        title: "New challenge ready!",
        description: "Your personalized challenge has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to generate challenge",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const challenge = activeChallenge;
  const isCompleted = challenge?.status === "completed";
  const feedback = challenge?.feedbackJson ? JSON.parse(challenge.feedbackJson) : null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!challenge) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold font-display text-foreground">
                Ready for a Voice Challenge?
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Get a personalized speaking prompt based on your interests. Practice your language skills and receive instant feedback!
              </p>
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-challenge"
            >
              {generateMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Challenge
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isCompleted ? "border-green-500/50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle className="font-display text-lg">Voice Challenge</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {challenge.languageGoal && (
            <Badge variant="secondary" className="text-xs">
              {challenge.languageGoal}
            </Badge>
          )}
          <Badge 
            variant={isCompleted ? "default" : "outline"}
            className={isCompleted ? "bg-green-500" : ""}
          >
            {isCompleted ? "Completed" : "Active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Your Prompt</p>
              <p className="text-foreground" data-testid="text-challenge-prompt">
                {challenge.prompt}
              </p>
            </div>
          </div>
        </div>

        {challenge.sourceFact && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            <span>Based on: {challenge.sourceFact.substring(0, 50)}...</span>
          </div>
        )}

        {isCompleted && feedback && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <ScoreCard label="Grammar" score={feedback.grammarScore} />
                <ScoreCard label="Vocabulary" score={feedback.vocabularyScore} />
                <ScoreCard label="Overall" score={feedback.overallScore} highlight />
              </div>

              {feedback.summary && (
                <div className="bg-primary/5 rounded-lg p-3">
                  <p className="text-sm text-foreground">{feedback.summary}</p>
                </div>
              )}

              {feedback.corrections && feedback.corrections.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Corrections</p>
                  {feedback.corrections.map((correction: any, index: number) => (
                    <div key={index} className="bg-destructive/5 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm line-through text-muted-foreground">
                          {correction.original}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pl-6">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600 dark:text-green-400">
                          {correction.corrected}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        {correction.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {challenge.xpEarned && challenge.xpEarned > 0 && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <span className="font-bold text-foreground">+{challenge.xpEarned} XP earned!</span>
                </div>
              )}

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="w-full"
                data-testid="button-new-challenge"
              >
                {generateMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                New Challenge
              </Button>
            </motion.div>
          </AnimatePresence>
        )}

        {!isCompleted && (
          <div className="bg-accent/10 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Mic className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  How to complete this challenge
                </p>
                <p className="text-xs text-muted-foreground">
                  Say "lingua learn" to your Omi device, then speak your response. Your speech will be analyzed automatically.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreCard({ 
  label, 
  score, 
  highlight = false 
}: { 
  label: string; 
  score: number; 
  highlight?: boolean;
}) {
  const color = score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500";
  
  return (
    <div className={`text-center p-3 rounded-lg ${highlight ? "bg-primary/10" : "bg-muted/50"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold font-display ${highlight ? "text-primary" : color}`}>
        {score}
      </p>
      <Progress 
        value={score} 
        className={`h-1 mt-1 ${highlight ? "[&>div]:bg-primary" : ""}`} 
      />
    </div>
  );
}
