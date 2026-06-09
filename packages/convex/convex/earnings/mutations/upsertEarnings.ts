import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";

/** Upsert a batch of earnings entries for a stock, keyed by (symbol, date). */
export const upsertEarnings = internalMutation({
  args: {
    stockId: vv.id("stocks"),
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
