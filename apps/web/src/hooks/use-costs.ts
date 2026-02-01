import { useQuery } from "convex/react";
import { api } from "@repo/convex";

// --- Query Hooks ---

interface UseMonthlyCostOptions {
  monthTimestamp?: number;
}

export function useMonthlyCost(options: UseMonthlyCostOptions = {}) {
  return useQuery(api.costTracking.getMonthlyCost, {
    monthTimestamp: options.monthTimestamp,
  });
}

interface UseCostHistoryOptions {
  months?: number;
}

export function useCostHistory(options: UseCostHistoryOptions = {}) {
  return useQuery(api.costTracking.getCostHistory, {
    months: options.months,
  });
}

interface UseCostByProviderOptions {
  from?: number;
  to?: number;
}

export function useCostByProvider(options: UseCostByProviderOptions = {}) {
  return useQuery(api.costTracking.getCostByProvider, {
    from: options.from,
    to: options.to,
  });
}
