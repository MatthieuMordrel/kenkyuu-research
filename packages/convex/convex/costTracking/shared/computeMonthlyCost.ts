import type { QueryCtx, MutationCtx } from "../../_generated/server";

/** Computes the calendar-month cost totals directly from the database. */
export async function computeMonthlyCost(
  ctx: QueryCtx | MutationCtx,
  monthTimestamp?: number
) {
  const target = new Date(monthTimestamp ?? Date.now());
  const startOfMonth = new Date(
    target.getFullYear(),
    target.getMonth(),
    1
  ).getTime();
  const startOfNextMonth = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    1
  ).getTime();

  const logs = await ctx.db
    .query("costLogs")
    .withIndex("by_timestamp", (q) =>
      q.gte("timestamp", startOfMonth).lt("timestamp", startOfNextMonth)
    )
    .collect();

  const totalCost = logs.reduce((sum, log) => sum + log.costUsd, 0);

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    jobCount: logs.length,
    monthStart: startOfMonth,
    monthEnd: startOfNextMonth,
  };
}
