import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";

export function useEarningsSummary() {
  return useQuery(api.earnings.getEarningsSummaryAll);
}

export function useStockEarnings(stockId: GenericId<"stocks">) {
  return useQuery(api.earnings.getEarningsByStockId, { stockId });
}
