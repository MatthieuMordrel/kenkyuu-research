import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Summarize previous/next/nextNext earnings dates per stock within a 1-year back / 1-year ahead window. */
export const getEarningsSummaryAll = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const today = new Date().toISOString().split("T")[0]!;
    // Only fetch earnings within a relevant window: 1 year back + 1 year ahead
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAhead = new Date();
    oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
    const dateFrom = oneYearAgo.toISOString().split("T")[0]!;
    const dateTo = oneYearAhead.toISOString().split("T")[0]!;

    const allEarnings = await ctx.db
      .query("earnings")
      .withIndex("by_date", (q) => q.gte("date", dateFrom).lte("date", dateTo))
      .collect();

    const byStock: Record<
      string,
      {
        previous?: { date: string; hour?: string };
        next?: { date: string; hour?: string };
        nextNext?: { date: string; hour?: string };
      }
    > = {};

    // Group by stockId
    const grouped: Record<string, typeof allEarnings> = {};
    for (const e of allEarnings) {
      const key = e.stockId;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    }

    for (const [stockId, entries] of Object.entries(grouped)) {
      const sorted = entries.toSorted((a, b) => a.date.localeCompare(b.date));
      const past = sorted.filter((e) => e.date < today);
      const future = sorted.filter((e) => e.date >= today);

      byStock[stockId] = {
        previous:
          past.length > 0
            ? {
                date: past[past.length - 1]!.date,
                hour: past[past.length - 1]!.hour,
              }
            : undefined,
        next:
          future.length > 0
            ? { date: future[0]!.date, hour: future[0]!.hour }
            : undefined,
        nextNext:
          future.length > 1
            ? { date: future[1]!.date, hour: future[1]!.hour }
            : undefined,
      };
    }

    return byStock;
  },
});
