import { Link, useLocation } from "wouter";
import { 
  Home, 
  Target, 
  BarChart3, 
  Trophy, 
  Settings, 
  Headphones,
  Zap
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { StreakCounter } from "@/components/streak-counter";
import { XpBadge } from "@/components/xp-badge";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Today's Challenges", url: "/challenges", icon: Target },
  { title: "Learning Items", url: "/items", icon: Headphones },
  { title: "Progress", url: "/progress", icon: BarChart3 },
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  streak?: number;
  xp?: number;
  level?: number;
}

export function AppSidebar({ streak = 0, xp = 0, level = 1 }: AppSidebarProps) {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2" data-testid="link-logo">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-foreground">LinguaFlow</h1>
            <p className="text-xs text-muted-foreground">Learn naturally</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2">
          <div className="p-4 rounded-lg bg-muted/50 mb-4">
            <StreakCounter streak={streak} />
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <XpBadge xp={xp} level={level} />
      </SidebarFooter>
    </Sidebar>
  );
}
