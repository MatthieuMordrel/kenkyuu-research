import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// --- Mutations ---

/**
 * Log a cost entry after job completion.
 * This is an alias kept here for domain clarity; the original logCost in
 * researchJobs.ts is still used by the webhook handler.
 */
export const logCost = internalMutation({
  args: {
    jobId: v.id("researchJobs"),
    provider: v.literal("openai"),
    costUsd: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("costLogs", {
      jobId: args.jobId,
      provider: args.provider,
      costUsd: args.costUsd,
      timestamp: Date.now(),
    });
  },
});

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
  },
  handler: async (ctx, args) => {
    const target = new Date(args.monthTimestamp ?? Date.now());
    const startOfMonth = new Date(
      target.getFullYear(),
      target.getMonth(),
      1,
    ).getTime();
    const startOfNextMonth = new Date(
      target.getFullYear(),
      target.getMonth() + 1,
      1,
    ).getTime();

    const logs = await ctx.db
      .query("costLogs")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", startOfMonth).lt("timestamp", startOfNextMonth),
      )
      .collect();

    const totalCost = logs.reduce((sum, log) => sum + log.costUsd, 0);
    const jobCount = logs.length;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      jobCount,
      monthStart: startOfMonth,
      monthEnd: startOfNextMonth,
    };
  },
});

/** Internal version of getMonthlyCost for use by actions (e.g., budget alerts). */
export const getMonthlyCostInternal = internalQuery({
  args: {
    monthTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const target = new Date(args.monthTimestamp ?? Date.now());
    const startOfMonth = new Date(
      target.getFullYear(),
      target.getMonth(),
      1,
    ).getTime();
    const startOfNextMonth = new Date(
      target.getFullYear(),
      target.getMonth() + 1,
      1,
    ).getTime();

    const logs = await ctx.db
      .query("costLogs")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", startOfMonth).lt("timestamp", startOfNextMonth),
      )
      .collect();

    const totalCost = logs.reduce((sum, log) => sum + log.costUsd, 0);
    const jobCount = logs.length;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      jobCount,
      monthStart: startOfMonth,
      monthEnd: startOfNextMonth,
    };
  },
});

/** Get cost breakdown grouped by provider. */
export const getCostByProvider = query({
  args: {
    /** Optional start timestamp filter (unix ms). */
    from: v.optional(v.number()),
    /** Optional end timestamp filter (unix ms). */
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let logsQuery = ctx.db.query("costLogs").withIndex("by_timestamp");

    if (args.from !== undefined && args.to !== undefined) {
      logsQuery = ctx.db
        .query("costLogs")
        .withIndex("by_timestamp", (q) =>
          q.gte("timestamp", args.from!).lt("timestamp", args.to!),
        );
    } else if (args.from !== undefined) {
      logsQuery = ctx.db
        .query("costLogs")
        .withIndex("by_timestamp", (q) =>
          q.gte("timestamp", args.from!),
        );
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
  },
  handler: async (ctx, args) => {
    const monthCount = Math.min(args.months ?? 6, 24);
    const now = new Date();

    // Compute start of the range
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - monthCount + 1,
      1,
    );
    const startTimestamp = startDate.getTime();

    const logs = await ctx.db
      .query("costLogs")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", startTimestamp),
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
        1,
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
