import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Monthly spend: total cost and job count for the current calendar month. */
export const monthlySpend = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).getTime();
    const startOfNextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    ).getTime();

    const logs = await ctx.db
      .query("costLogs")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", startOfMonth).lt("timestamp", startOfNextMonth)
      )
      .collect();

    const totalCost = logs.reduce((sum, log) => sum + log.costUsd, 0);

    const budgetSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "budget_threshold"))
      .unique();

    const budgetThreshold = budgetSetting
      ? Number.parseFloat(budgetSetting.value)
      : undefined;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      jobCount: logs.length,
      budgetThreshold:
        budgetThreshold !== undefined && !Number.isNaN(budgetThreshold)
          ? budgetThreshold
          : undefined,
    };
  },
});
