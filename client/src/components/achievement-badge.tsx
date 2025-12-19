import { motion } from "framer-motion";
import { Lock } from "lucide-react";

interface AchievementBadgeProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  unlocked?: boolean;
  className?: string;
}

export function AchievementBadge({
  title,
  description,
  icon,
  unlocked = false,
  className = "",
}: AchievementBadgeProps) {
  return (
    <motion.div
      className={`flex flex-col items-center gap-2 p-4 ${className}`}
      whileHover={unlocked ? { scale: 1.05 } : {}}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`
          relative w-16 h-16 rounded-full flex items-center justify-center
          ${unlocked 
            ? "bg-gradient-to-br from-primary to-teal-600 text-white shadow-lg shadow-primary/30" 
            : "bg-muted text-muted-foreground"
          }
        `}
        data-testid={`badge-${title.toLowerCase().replace(/\s/g, '-')}`}
      >
        {unlocked ? icon : <Lock className="h-6 w-6" />}
        {unlocked && (
          <motion.div
            className="absolute inset-0 rounded-full bg-white/20"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
      <div className="text-center">
        <p className={`text-sm font-medium ${unlocked ? "text-foreground" : "text-muted-foreground"}`}>
          {title}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </motion.div>
  );
}
