import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@repo/convex";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useResearchFlow } from "./use-research-flow";
import { useAuthToken } from "@/lib/auth";

// --- Dashboard Query Hooks ---

/** Last 5 completed/failed research jobs with enriched prompt + stock info. */
export function useRecentResearch() {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(api.dashboard.recentResearch, token ? { token } : "skip")
  );
  return data;
}

/** Top 5 upcoming scheduled runs sorted by next run time. */
export function useUpcomingSchedules() {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(api.dashboard.upcomingSchedules, token ? { token } : "skip")
  );
  return data;
}

/** Monthly cost summary with budget threshold. */
export function useMonthlySpend() {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(api.dashboard.monthlySpend, token ? { token } : "skip")
  );
  return data;
}

/** Count of active (pending + running) jobs and the concurrency limit. */
export function useActiveJobsCount() {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(api.dashboard.activeJobsCount, token ? { token } : "skip")
  );
  return data;
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
    navigate({ to: "/research" });
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
