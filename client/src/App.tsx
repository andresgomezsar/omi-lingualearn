import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
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
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar streak={7} xp={1250} level={3} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <OmiStatus connected={true} streaming={false} />
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard">
        <DashboardLayout><Home /></DashboardLayout>
      </Route>
      <Route path="/challenges">
        <DashboardLayout><Challenges /></DashboardLayout>
      </Route>
      <Route path="/items">
        <DashboardLayout><LearningItems /></DashboardLayout>
      </Route>
      <Route path="/progress">
        <DashboardLayout><Progress /></DashboardLayout>
      </Route>
      <Route path="/achievements">
        <DashboardLayout><Achievements /></DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout><Settings /></DashboardLayout>
      </Route>
      <Route path="/chat">
        <DashboardLayout><Chat /></DashboardLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="linguaflow-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
