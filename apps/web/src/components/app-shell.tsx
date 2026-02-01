import { Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  FlaskConical,
  Clock,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/stocks", label: "Stocks", icon: TrendingUp },
  { to: "/prompts", label: "Prompts", icon: FileText },
  { to: "/research", label: "Research", icon: FlaskConical },
  { to: "/schedules", label: "Schedules", icon: Clock },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const mobileNavItems = navItems.slice(0, 5);

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function Sidebar() {
  const { logout } = useAuth();
  const matchRoute = useMatchRoute();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <FlaskConical className="size-5 text-sidebar-primary" />
        <span className="font-semibold">KenkyuStock</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const isActive = item.to === "/"
            ? matchRoute({ to: "/", fuzzy: false })
            : matchRoute({ to: item.to, fuzzy: true });
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
      <div className="border-t p-2">
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

function BottomNav() {
  const matchRoute = useMatchRoute();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const isActive = item.to === "/"
            ? matchRoute({ to: "/", fuzzy: false })
            : matchRoute({ to: item.to, fuzzy: true });
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
