import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireAuth } from "./authHelpers";

export const listAllStocksInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stocks").collect();
  },
});

export const upsertEarnings = internalMutation({
  args: {
    stockId: v.id("stocks"),
    symbol: v.string(),
    entries: v.array(
      v.object({
        date: v.string(),
        epsEstimate: v.optional(v.number()),
        epsActual: v.optional(v.number()),
        revenueEstimate: v.optional(v.number()),
        revenueActual: v.optional(v.number()),
        hour: v.optional(v.string()),
        quarter: v.optional(v.number()),
        year: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Entries are keyed by distinct (symbol, date) pairs, so each upsert is
    // independent and can run in parallel within the mutation transaction.
    await Promise.all(
      args.entries.map(async (entry) => {
        const existing = await ctx.db
          .query("earnings")
          .withIndex("by_symbol_date", (q) =>
            q.eq("symbol", args.symbol).eq("date", entry.date)
          )
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            ...entry,
            stockId: args.stockId,
            symbol: args.symbol,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("earnings", {
            stockId: args.stockId,
            symbol: args.symbol,
            ...entry,
            updatedAt: now,
          });
        }
      })
    );
  },
});

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

export const getEarningsByStockId = query({
  args: { stockId: v.id("stocks"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const earnings = await ctx.db
      .query("earnings")
      .withIndex("by_stockId", (q) => q.eq("stockId", args.stockId))
      .collect();
    return earnings.toSorted((a, b) => a.date.localeCompare(b.date));
  },
});
