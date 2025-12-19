import { Star } from "lucide-react";
import { motion } from "framer-motion";

interface XpBadgeProps {
  xp: number;
  level: number;
  className?: string;
}

export function XpBadge({ xp, level, className = "" }: XpBadgeProps) {
  const xpForNextLevel = level * 500;
  const currentLevelXp = (level - 1) * 500;
  const progress = ((xp - currentLevelXp) / (xpForNextLevel - currentLevelXp)) * 100;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <motion.div
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary to-teal-600"
        whileHover={{ scale: 1.05 }}
      >
        <Star className="h-5 w-5 text-white fill-white" />
        <span 
          className="absolute -bottom-1 -right-1 text-xs font-bold bg-secondary text-secondary-foreground rounded-full w-5 h-5 flex items-center justify-center"
          data-testid="text-level"
        >
          {level}
        </span>
      </motion.div>
      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground" data-testid="text-xp">
            {xp.toLocaleString()} XP
          </span>
          <span className="text-xs text-muted-foreground">
            {xpForNextLevel - xp} to next level
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-teal-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}
