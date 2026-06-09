import { v } from "convex/values";
import { query } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";

/** List all earnings entries for a stock, sorted by date ascending. */
export const getEarningsByStockId = query({
  args: { stockId: vv.id("stocks"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const earnings = await ctx.db
      .query("earnings")
      .withIndex("by_stockId", (q) => q.eq("stockId", args.stockId))
      .collect();
    return earnings.toSorted((a, b) => a.date.localeCompare(b.date));
  },
});
