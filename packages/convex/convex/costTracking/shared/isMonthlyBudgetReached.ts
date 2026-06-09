import type { QueryCtx, MutationCtx } from "../../_generated/server";
import { computeMonthlyCost } from "./computeMonthlyCost";
import { getBudgetThreshold } from "./getBudgetThreshold";

/**
 * Determines whether this calendar month's spend has reached the budget.
 * When no threshold is configured, the budget is never considered reached.
 */
export async function isMonthlyBudgetReached(
  ctx: QueryCtx | MutationCtx
): Promise<{ reached: boolean; totalCost: number; threshold: number | null }> {
  const threshold = await getBudgetThreshold(ctx);
  if (threshold === null) {
    return { reached: false, totalCost: 0, threshold: null };
  }
  const { totalCost } = await computeMonthlyCost(ctx);
  return { reached: totalCost >= threshold, totalCost, threshold };
}
