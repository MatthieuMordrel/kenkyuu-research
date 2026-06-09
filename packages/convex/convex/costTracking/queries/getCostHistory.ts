import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

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
      .toSorted((a, b) => a.timestamp - b.timestamp)
      .map((entry) => ({
        month: entry.month,
        totalCost: Math.round(entry.totalCost * 100) / 100,
        jobCount: entry.jobCount,
      }));
  },
});
