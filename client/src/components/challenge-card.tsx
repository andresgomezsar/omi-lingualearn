import { CheckCircle2, Volume2, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface ChallengeCardProps {
  id: number;
  originalText: string;
  correctedText: string;
  explanation: string;
  category: string;
  xpReward?: number;
  completed?: boolean;
  onComplete?: (id: number, quality: number) => void;
  onPlayAudio?: () => void;
}

export function ChallengeCard({
  id,
  originalText,
  correctedText,
  explanation,
  category,
  xpReward = 25,
  completed = false,
  onComplete,
  onPlayAudio,
}: ChallengeCardProps) {
  const categoryColors: Record<string, string> = {
    grammar: "bg-primary/10 text-primary border-primary/20",
    vocabulary: "bg-accent/10 text-accent border-accent/20",
    pronunciation: "bg-secondary/10 text-secondary-foreground border-secondary/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className={`overflow-visible transition-all duration-200 ${completed ? "opacity-60" : ""}`}
        data-testid={`card-challenge-${id}`}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className={`${categoryColors[category] || categoryColors.grammar}`}
            >
              {category}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>+{xpReward} XP</span>
            </div>
          </div>
          {completed && (
            <CheckCircle2 className="h-5 w-5 text-green-500" data-testid="icon-completed" />
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
              <p className="text-xs text-muted-foreground mb-1">You said:</p>
              <p className="text-foreground font-medium" data-testid="text-original">
                "{originalText}"
              </p>
            </div>

            <div className="flex items-center justify-center">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
              <p className="text-xs text-muted-foreground mb-1">Better way:</p>
              <p className="text-foreground font-medium" data-testid="text-corrected">
                "{correctedText}"
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground" data-testid="text-explanation">
              {explanation}
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex gap-2 pt-0">
          {onPlayAudio && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onPlayAudio}
              data-testid="button-play-audio"
            >
              <Volume2 className="h-4 w-4 mr-1" />
              Listen
            </Button>
          )}
          {!completed && onComplete && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => onComplete(id, 5)}
              data-testid="button-complete-challenge"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Got it!
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
