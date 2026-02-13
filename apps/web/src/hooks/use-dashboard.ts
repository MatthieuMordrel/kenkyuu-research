import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useResearchFlow } from "./use-research-flow";
import { useAuthToken } from "@/lib/auth";

// --- Dashboard Query Hooks ---

/** Last 5 completed/failed research jobs with enriched prompt + stock info. */
export function useRecentResearch() {
  const token = useAuthToken();
  return useQuery(api.dashboard.recentResearch, token ? { token } : "skip");
}

/** Top 5 upcoming scheduled runs sorted by next run time. */
export function useUpcomingSchedules() {
  const token = useAuthToken();
  return useQuery(api.dashboard.upcomingSchedules, token ? { token } : "skip");
}

/** Monthly cost summary with budget threshold. */
export function useMonthlySpend() {
  const token = useAuthToken();
  return useQuery(api.dashboard.monthlySpend, token ? { token } : "skip");
}

/** Count of active (pending + running) jobs and the concurrency limit. */
export function useActiveJobsCount() {
  const token = useAuthToken();
  return useQuery(api.dashboard.activeJobsCount, token ? { token } : "skip");
}

// --- Quick Action Handlers ---

export function useQuickActions() {
  const navigate = useNavigate();
  const flow = useResearchFlow();

  const startNewResearch = useCallback(() => {
    flow.open();
    navigate({ to: "/research" });
  }, [flow, navigate]);

  const goToAddStock = useCallback(() => {
    navigate({ to: "/stocks" });
  }, [navigate]);

  const goToHistory = useCallback(() => {
    navigate({ to: "/history" });
  }, [navigate]);

  const goToSchedules = useCallback(() => {
    navigate({ to: "/schedules" });
  }, [navigate]);

  return {
    startNewResearch,
    goToAddStock,
    goToHistory,
    goToSchedules,
  } as const;
}

// --- Combined Dashboard Hook ---

export function useDashboard() {
  const recentResearch = useRecentResearch();
  const upcomingSchedules = useUpcomingSchedules();
  const monthlySpend = useMonthlySpend();
  const activeJobs = useActiveJobsCount();
  const quickActions = useQuickActions();

  const isLoading =
    recentResearch === undefined ||
    upcomingSchedules === undefined ||
    monthlySpend === undefined ||
    activeJobs === undefined;

  return {
    recentResearch,
    upcomingSchedules,
    monthlySpend,
    activeJobs,
    quickActions,
    isLoading,
  } as const;
}
