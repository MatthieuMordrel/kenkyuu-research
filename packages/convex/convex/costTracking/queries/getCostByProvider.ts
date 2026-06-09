import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

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
