import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { 
  Settings as SettingsIcon, 
  Globe, 
  Bell, 
  Moon, 
  Bluetooth,
  Volume2,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Info,
  Zap,
  Cloud,
  Mic
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme-provider";
import { useToast } from "@/hooks/use-toast";

interface OmiSetupInfo {
  webhooks: {
    transcript: string;
    memory: string;
    audio: string;
  };
  manifest_url: string;
  setup_complete_url: string;
  app_home_url: string;
  gcp_configured: boolean;
  instructions: string[];
}

interface GcpStatus {
  configured: boolean;
  connected: boolean;
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [dailyReminder, setDailyReminder] = useState("09:00");
  const [nativeLanguage, setNativeLanguage] = useState("english");
  const [targetLanguage, setTargetLanguage] = useState("spanish");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: setupInfo } = useQuery<OmiSetupInfo>({
    queryKey: ["/api/omi/setup-info"],
  });

  const { data: omiStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/omi/status"],
  });

  const { data: gcpStatus } = useQuery<GcpStatus>({
    queryKey: ["/api/gcp/status"],
  });

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied!",
        description: "URL copied to clipboard",
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => copyToClipboard(text, field)}
      data-testid={`button-copy-${field}`}
    >
      {copiedField === field ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <SettingsIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Customize your learning experience
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Bluetooth className="h-5 w-5 text-primary" />
                <CardTitle className="font-display">Omi Device Setup</CardTitle>
              </div>
              {omiStatus?.connected ? (
                <Badge variant="default" className="bg-green-500">
                  <Check className="h-3 w-3 mr-1" /> Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not Connected</Badge>
              )}
            </div>
            <CardDescription>
              Connect your Omi AI necklace to analyze your conversations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">How to connect:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    {setupInfo?.instructions.map((instruction, index) => (
                      <li key={index}>{instruction}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Webhook URLs
              </h4>
              
              <div className="space-y-2">
                <Label htmlFor="transcript-webhook" className="text-xs text-muted-foreground">
                  Real-time Transcript Webhook (required)
                </Label>
                <div className="flex gap-2">
                  <Input 
                    id="transcript-webhook"
                    value={setupInfo?.webhooks.transcript || ""}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-transcript-webhook"
                  />
                  <CopyButton text={setupInfo?.webhooks.transcript || ""} field="transcript" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audio-webhook" className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mic className="h-3 w-3" />
                  Audio Bytes Webhook (for pronunciation analysis)
                </Label>
                <div className="flex gap-2">
                  <Input 
                    id="audio-webhook"
                    value={setupInfo?.webhooks.audio || ""}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-audio-webhook"
                  />
                  <CopyButton text={setupInfo?.webhooks.audio || ""} field="audio" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Streams raw audio for pronunciation analysis via Gemini
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="memory-webhook" className="text-xs text-muted-foreground">
                  Memory Trigger Webhook (optional)
                </Label>
                <div className="flex gap-2">
                  <Input 
                    id="memory-webhook"
                    value={setupInfo?.webhooks.memory || ""}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-memory-webhook"
                  />
                  <CopyButton text={setupInfo?.webhooks.memory || ""} field="memory" />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                GCP Storage Status
              </h4>
              <div className="flex items-center gap-3">
                {gcpStatus?.connected ? (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" /> Connected
                  </Badge>
                ) : gcpStatus?.configured ? (
                  <Badge variant="secondary">Configured (not tested)</Badge>
                ) : (
                  <Badge variant="destructive">Not Configured</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {gcpStatus?.connected 
                    ? "Audio will be stored in your GCP bucket for analysis"
                    : gcpStatus?.configured
                    ? "GCP credentials found but connection not verified"
                    : "Add GCP_SERVICE_ACCOUNT_JSON and GCP_BUCKET_NAME secrets"
                  }
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-sm text-foreground">App Configuration URLs</h4>
              
              <div className="space-y-2">
                <Label htmlFor="manifest-url" className="text-xs text-muted-foreground">
                  Chat Tools Manifest URL
                </Label>
                <div className="flex gap-2">
                  <Input 
                    id="manifest-url"
                    value={setupInfo?.manifest_url || ""}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-manifest-url"
                  />
                  <CopyButton text={setupInfo?.manifest_url || ""} field="manifest" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enables AI chat tools: analyze speech, get learning status, add to queue
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="setup-complete-url" className="text-xs text-muted-foreground">
                  Setup Complete URL
                </Label>
                <div className="flex gap-2">
                  <Input 
                    id="setup-complete-url"
                    value={setupInfo?.setup_complete_url || ""}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-setup-complete-url"
                  />
                  <CopyButton text={setupInfo?.setup_complete_url || ""} field="setup-complete" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="app-home-url" className="text-xs text-muted-foreground">
                  App Home URL
                </Label>
                <div className="flex gap-2">
                  <Input 
                    id="app-home-url"
                    value={setupInfo?.app_home_url || ""}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-app-home-url"
                  />
                  <CopyButton text={setupInfo?.app_home_url || ""} field="app-home" />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" asChild data-testid="button-open-omi-docs">
                <a href="https://docs.omi.me/doc/developer/apps/Introduction" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Omi Developer Docs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle className="font-display">Language Settings</CardTitle>
            </div>
            <CardDescription>
              Configure your native and target languages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="native-language">Native Language</Label>
                <Select value={nativeLanguage} onValueChange={setNativeLanguage}>
                  <SelectTrigger id="native-language" data-testid="select-native-language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                    <SelectItem value="mandarin">Mandarin</SelectItem>
                    <SelectItem value="japanese">Japanese</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-language">Learning Language</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger id="target-language" data-testid="select-target-language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                    <SelectItem value="mandarin">Mandarin</SelectItem>
                    <SelectItem value="japanese">Japanese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="font-display">Notifications</CardTitle>
            </div>
            <CardDescription>
              Configure how and when you receive reminders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive daily challenge reminders
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={setNotifications}
                data-testid="switch-notifications"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="sound">Sound Effects</Label>
                <p className="text-sm text-muted-foreground">
                  Play sounds for achievements and completions
                </p>
              </div>
              <Switch
                id="sound"
                checked={soundEffects}
                onCheckedChange={setSoundEffects}
                data-testid="switch-sound"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminder-time">Daily Reminder Time</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="reminder-time"
                  type="time"
                  value={dailyReminder}
                  onChange={(e) => setDailyReminder(e.target.value)}
                  className="w-32"
                  data-testid="input-reminder-time"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-primary" />
              <CardTitle className="font-display">Appearance</CardTitle>
            </div>
            <CardDescription>
              Customize the look and feel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("light")}
                  data-testid="button-theme-light"
                >
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("dark")}
                  data-testid="button-theme-dark"
                >
                  Dark
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme("system")}
                  data-testid="button-theme-system"
                >
                  System
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-end"
      >
        <Button data-testid="button-save-settings">
          Save Changes
        </Button>
      </motion.div>
    </div>
  );
}
