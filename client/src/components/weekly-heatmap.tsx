import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DayData {
  date: string;
  count: number;
}

interface WeeklyHeatmapProps {
  data: DayData[];
  className?: string;
}

export function WeeklyHeatmap({ data, className = "" }: WeeklyHeatmapProps) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getIntensity = (count: number) => {
    if (count === 0) return "bg-muted";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "bg-primary/20";
    if (ratio < 0.5) return "bg-primary/40";
    if (ratio < 0.75) return "bg-primary/70";
    return "bg-primary";
  };

  return (
    <div className={`${className}`}>
      <div className="flex gap-1">
        {days.map((day, index) => {
          const dayData = data[index] || { date: day, count: 0 };
          return (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <div
                  className={`
                    w-8 h-8 rounded-md ${getIntensity(dayData.count)}
                    flex items-center justify-center text-xs font-medium
                    transition-all duration-200 cursor-default
                    ${dayData.count > 0 ? "text-primary-foreground" : "text-muted-foreground"}
                  `}
                  data-testid={`heatmap-${day.toLowerCase()}`}
                >
                  {day[0]}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{day}: {dayData.count} challenges completed</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
