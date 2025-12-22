import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@/contexts/UserContext";

export function AuthModal() {
  const { login, error, isLoading, isAuthenticated } = useUser();
  const [userInput, setUserInput] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userInput.trim()) {
      return;
    }

    try {
      await login(userInput.trim());
      setShowSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
      }, 1000);
    } catch (err) {
      // Error is handled by UserContext
    }
  };

  // Don't show modal if user is authenticated
  if (isAuthenticated && !isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Key className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-display">
                Welcome to LinguaLearn
              </DialogTitle>
              <DialogDescription className="mt-1">
                Enter your User ID or Omi UID to access your account
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="user-id">User ID / Omi UID</Label>
            <Input
              id="user-id"
              type="text"
              placeholder="d0a4e344-c930-46ad-9949-7811603f6fe9"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={isLoading || showSuccess}
              className="font-mono text-sm"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This is your unique identifier from your Omi device or LinguaLearn account
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
              >
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}

            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md"
              >
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-600 dark:text-green-400">
                  Successfully authenticated! Loading your dashboard...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={!userInput.trim() || isLoading || showSuccess}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : showSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Success!
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Your User ID is stored securely in your browser and acts as your authentication key.
              Keep it private and don't share it with others.
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
