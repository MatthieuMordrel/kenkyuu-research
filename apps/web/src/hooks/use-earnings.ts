import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useAuthToken } from "@/lib/auth";

export function useEarningsSummary() {
  const token = useAuthToken();
  return useQuery(api.earnings.getEarningsSummaryAll, token ? { token } : "skip");
}

export function useStockEarnings(stockId: GenericId<"stocks">) {
  const token = useAuthToken();
  return useQuery(api.earnings.getEarningsByStockId, token ? { stockId, token } : "skip");
}
