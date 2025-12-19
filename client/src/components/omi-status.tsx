import { Bluetooth, BluetoothOff, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface OmiStatusProps {
  connected: boolean;
  streaming?: boolean;
  className?: string;
}

export function OmiStatus({ connected, streaming = false, className = "" }: OmiStatusProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`
            gap-1.5 cursor-default
            ${connected 
              ? streaming 
                ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400" 
                : "border-primary/30 bg-primary/10 text-primary"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
            }
            ${className}
          `}
          data-testid="badge-omi-status"
        >
          {connected ? (
            streaming ? (
              <>
                <Wifi className="h-3 w-3 animate-pulse" />
                <span>Streaming</span>
              </>
            ) : (
              <>
                <Bluetooth className="h-3 w-3" />
                <span>Connected</span>
              </>
            )
          ) : (
            <>
              <BluetoothOff className="h-3 w-3" />
              <span>Disconnected</span>
            </>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {connected 
          ? streaming 
            ? "Omi is actively recording your conversations"
            : "Omi necklace is connected"
          : "Connect your Omi device to start learning"
        }
      </TooltipContent>
    </Tooltip>
  );
}
