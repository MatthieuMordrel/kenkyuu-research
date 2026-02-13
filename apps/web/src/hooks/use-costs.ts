import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { useAuthToken } from "@/lib/auth";

// --- Query Hooks ---

interface UseMonthlyCostOptions {
  monthTimestamp?: number;
}

export function useMonthlyCost(options: UseMonthlyCostOptions = {}) {
  const token = useAuthToken();
  return useQuery(
    api.costTracking.getMonthlyCost,
    token
      ? { monthTimestamp: options.monthTimestamp, token }
      : "skip",
  );
}

interface UseCostHistoryOptions {
  months?: number;
}

export function useCostHistory(options: UseCostHistoryOptions = {}) {
  const token = useAuthToken();
  return useQuery(
    api.costTracking.getCostHistory,
    token
      ? { months: options.months, token }
      : "skip",
  );
}

interface UseCostByProviderOptions {
  from?: number;
  to?: number;
}

export function useCostByProvider(options: UseCostByProviderOptions = {}) {
  const token = useAuthToken();
  return useQuery(
    api.costTracking.getCostByProvider,
    token
      ? { from: options.from, to: options.to, token }
      : "skip",
  );
}
