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

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/stocks", label: "Stocks", icon: TrendingUp },
  { to: "/prompts", label: "Prompts", icon: FileText },
  { to: "/research", label: "Research", icon: FlaskConical },
  { to: "/history", label: "History", icon: History },
  { to: "/schedules", label: "Schedules", icon: Clock },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const mobileNavItems = navItems.slice(0, 5);

export function AppShell() {
  const location = useLocation();
  // Initialize theme on mount and listen for system preference changes
  useTheme();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0">
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}

function Sidebar() {
  const { logout } = useAuth();
  const location = useLocation();
  const { resolvedTheme, toggle } = useTheme();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <FlaskConical className="size-5 text-sidebar-primary" />
        <span className="font-semibold">KenkyuStock</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive = item.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <SidebarActiveJobs />
      <div className="flex flex-col gap-1 border-t p-2">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button
          type="button"
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </aside>
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
    <div className="border-t px-2 py-2">
      <div className="mb-1.5 flex items-center justify-between px-2">
        <span className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">
          Active Jobs
        </span>
        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
          {activeJobs.count}/{activeJobs.limit}
        </span>
      </div>
      <div className="max-h-48 space-y-0.5 overflow-y-auto">
        {activeJobs.jobs.map((job) => {
          const isRunning = job.status === "running";
          return (
            <Link
              key={job._id}
              to="/research"
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent/50"
            >
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  isRunning
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isRunning ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Clock className="size-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-sidebar-foreground">
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
          );
        })}
      </div>
    </div>
  );
}

function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const isActive = item.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
