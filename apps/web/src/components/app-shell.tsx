import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useActiveJobs } from "@/hooks/use-research";
import { usePrompts } from "@/hooks/use-prompts";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  FlaskConical,
  Clock,
  Settings,
  LogOut,
  History,
  Sun,
  Moon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";
import { useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/stocks", label: "Stocks", icon: TrendingUp },
  { to: "/prompts", label: "Prompts", icon: FileText },
  { to: "/research", label: "Research", icon: FlaskConical },
  { to: "/history", label: "History", icon: History },
  { to: "/schedules", label: "Schedules", icon: Clock },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const location = useLocation();
  useTheme();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <FlaskConical className="size-5 text-sidebar-primary" />
          <span className="font-semibold">KenkyuStock</span>
        </header>
        <main className="flex-1">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebar() {
  const { logout } = useAuth();
  const location = useLocation();
  const { resolvedTheme, toggle } = useTheme();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <FlaskConical className="size-4" />
                </div>
                <span className="font-semibold">KenkyuStock</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarActiveJobs />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggle} tooltip={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              <span>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => logout()} tooltip="Sign out">
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function formatRelativeTime(timestamp: number, now: number) {
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function SidebarActiveJobs() {
  const activeJobs = useActiveJobs();
  const prompts = usePrompts();
  const now = useNow();

  const promptMap = useMemo(() => {
    if (!prompts) return new Map<string, string>();
    return new Map(prompts.map((p) => [p._id, p.name]));
  }, [prompts]);

  if (!activeJobs || activeJobs.count === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <span>Active Jobs</span>
        <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
          {activeJobs.count}/{activeJobs.limit}
        </span>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {activeJobs.jobs.map((job) => {
            const isRunning = job.status === "running";
            return (
              <SidebarMenuItem key={job._id}>
                <SidebarMenuButton asChild tooltip={promptMap.get(job.promptId) ?? "Research Job"}>
                  <Link to="/research">
                    <div
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full",
                        isRunning
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {isRunning ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Clock className="size-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {promptMap.get(job.promptId) ?? "Research Job"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {job.stockIds.length} stock{job.stockIds.length !== 1 ? "s" : ""}{" "}
                        · {formatRelativeTime(job.createdAt, now)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        isRunning ? "bg-primary" : "bg-muted-foreground/50",
                      )}
                    />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
