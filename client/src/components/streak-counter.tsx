import { Flame } from "lucide-react";
import { motion } from "framer-motion";

interface StreakCounterProps {
  streak: number;
  className?: string;
}

export function StreakCounter({ streak, className = "" }: StreakCounterProps) {
  return (
    <motion.div
      className={`flex items-center gap-2 ${className}`}
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <motion.div
        className="relative"
        animate={{ 
          scale: [1, 1.1, 1],
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          repeatType: "reverse"
        }}
      >
        <Flame 
          className="h-8 w-8 text-orange-500 fill-orange-500" 
          data-testid="icon-streak-flame"
        />
      </motion.div>
      <div className="flex flex-col">
        <span 
          className="text-2xl font-bold font-display text-foreground"
          data-testid="text-streak-count"
        >
          {streak}
        </span>
        <span className="text-xs text-muted-foreground">day streak</span>
      </div>
    </motion.div>
  );
}
