import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { AuthModal } from "@/components/AuthModal";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { OmiStatus } from "@/components/omi-status";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Challenges from "@/pages/challenges";
import LearningItems from "@/pages/learning-items";
import Progress from "@/pages/progress";
import Achievements from "@/pages/achievements";
import Settings from "@/pages/settings";
import Chat from "@/pages/chat";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { data: connection } = useQuery<{ connected: boolean }>({ queryKey: ["/api/omi/status"], refetchInterval: 30000 });

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar
          streak={user?.streak ?? 0}
          xp={user?.totalXp ?? 0}
          level={user?.level ?? 1}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <OmiStatus connected={connection?.connected ?? false} streaming={false} />
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useUser();

  // Show nothing while checking authentication
  if (isLoading) {
    return null;
  }

  // Block content if not authenticated - AuthModal will show
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout><Home /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/challenges">
        <ProtectedRoute>
          <DashboardLayout><Challenges /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/items">
        <ProtectedRoute>
          <DashboardLayout><LearningItems /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/progress">
        <ProtectedRoute>
          <DashboardLayout><Progress /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/achievements">
        <ProtectedRoute>
          <DashboardLayout><Achievements /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <DashboardLayout><Settings /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/chat">
        <ProtectedRoute>
          <DashboardLayout><Chat /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  const { isAuthenticated } = useUser();

  // Only show auth modal on protected routes when not authenticated
  const isProtectedRoute = location !== "/" && !location.startsWith("/omi");
  const showAuthModal = isProtectedRoute && !isAuthenticated;

  return (
    <>
      {showAuthModal && <AuthModal />}
      <Router />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="linguaflow-theme">
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <TooltipProvider>
            <AppContent />
          </TooltipProvider>
        </UserProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
