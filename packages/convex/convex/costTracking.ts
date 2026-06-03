import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireAuth } from "./authHelpers";

/** User-facing error thrown when the monthly budget blocks a new research run. */
export const BUDGET_REACHED_MESSAGE =
  "Monthly budget reached — new research is paused. Raise or clear the budget threshold in Settings to continue.";

// --- Shared helpers (callable from any query/mutation/action ctx) ---

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

/**
 * Reads the configured monthly budget threshold (USD).
 * Returns null when unset, non-numeric, or non-positive (i.e. enforcement off).
 */
export async function getBudgetThreshold(
  ctx: QueryCtx | MutationCtx
): Promise<number | null> {
  const setting = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "budget_threshold"))
    .unique();
  if (!setting) return null;
  const threshold = parseFloat(setting.value);
  return Number.isFinite(threshold) && threshold > 0 ? threshold : null;
}

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

/** Throws {@link BUDGET_REACHED_MESSAGE} when the monthly budget is reached. */
export async function assertWithinBudget(
  ctx: QueryCtx | MutationCtx
): Promise<void> {
  const { reached } = await isMonthlyBudgetReached(ctx);
  if (reached) {
    throw new Error(BUDGET_REACHED_MESSAGE);
  }
}

// --- Mutations ---

/** Mark that a budget alert has been sent for a given month. */
export const markBudgetAlertSent = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: "true" });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: "true" });
    }
  },
});

// --- Queries ---

/** Get total cost for the current calendar month. */
export const getMonthlyCost = query({
  args: {
    /** Optional: override the month to query (unix ms of any moment in the desired month). Defaults to now. */
    monthTimestamp: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await computeMonthlyCost(ctx, args.monthTimestamp);
  },
});

/** Internal version of getMonthlyCost for use by actions (e.g., budget alerts). */
export const getMonthlyCostInternal = internalQuery({
  args: {
    monthTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await computeMonthlyCost(ctx, args.monthTimestamp);
  },
});

/**
 * Internal budget gate for the research dispatch action.
 * Returns whether this month's spend has reached the configured threshold.
 */
export const checkBudgetReachedInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await isMonthlyBudgetReached(ctx);
  },
});

/** Get cost breakdown grouped by provider. */
export const getCostByProvider = query({
  args: {
    /** Optional start timestamp filter (unix ms). */
    from: v.optional(v.number()),
    /** Optional end timestamp filter (unix ms). */
    to: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    let logsQuery = ctx.db.query("costLogs").withIndex("by_timestamp");

    if (args.from !== undefined && args.to !== undefined) {
      logsQuery = ctx.db
        .query("costLogs")
        .withIndex("by_timestamp", (q) =>
          q.gte("timestamp", args.from!).lt("timestamp", args.to!)
        );
    } else if (args.from !== undefined) {
      logsQuery = ctx.db
        .query("costLogs")
        .withIndex("by_timestamp", (q) => q.gte("timestamp", args.from!));
    }

    const logs = await logsQuery.collect();

    // Filter by `to` if only `to` was provided (no range index support for lt-only)
    const filtered =
      args.to !== undefined && args.from === undefined
        ? logs.filter((l) => l.timestamp < args.to!)
        : logs;

    const byProvider: Record<string, { totalCost: number; jobCount: number }> =
      {};

    for (const log of filtered) {
      const entry = byProvider[log.provider] ?? {
        totalCost: 0,
        jobCount: 0,
      };
      entry.totalCost += log.costUsd;
      entry.jobCount += 1;
      byProvider[log.provider] = entry;
    }

    return Object.entries(byProvider).map(([provider, data]) => ({
      provider,
      totalCost: Math.round(data.totalCost * 100) / 100,
      jobCount: data.jobCount,
    }));
  },
});

/** Get historical cost data grouped by month (last N months). */
export const getCostHistory = query({
  args: {
    /** Number of months to look back (default 6). */
    months: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const monthCount = Math.min(args.months ?? 6, 24);
    const now = new Date();

    // Compute start of the range
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - monthCount + 1,
      1
    );
    const startTimestamp = startDate.getTime();

    const endTimestamp = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    ).getTime();

    const logs = await ctx.db
      .query("costLogs")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", startTimestamp).lt("timestamp", endTimestamp)
      )
      .collect();

    // Group by month
    const monthlyData: Record<
      string,
      { totalCost: number; jobCount: number; month: string; timestamp: number }
    > = {};

    for (let i = 0; i < monthCount; i++) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth() - monthCount + 1 + i,
        1
      );
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = {
        totalCost: 0,
        jobCount: 0,
        month: key,
        timestamp: d.getTime(),
      };
    }

    for (const log of logs) {
      const d = new Date(log.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyData[key];
      if (entry) {
        entry.totalCost += log.costUsd;
        entry.jobCount += 1;
      }
    }

    return Object.values(monthlyData)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((entry) => ({
        month: entry.month,
        totalCost: Math.round(entry.totalCost * 100) / 100,
        jobCount: entry.jobCount,
      }));
  },
});
