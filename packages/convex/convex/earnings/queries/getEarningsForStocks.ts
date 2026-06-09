import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { vv } from "../../schema";

/** List all earnings entries for a set of stocks. */
export const getEarningsForStocks = internalQuery({
  args: { stockIds: v.array(vv.id("stocks")) },
  handler: async (ctx, args) => {
    const perStock = await Promise.all(
      args.stockIds.map((stockId) =>
        ctx.db
          .query("earnings")
          .withIndex("by_stockId", (q) => q.eq("stockId", stockId))
          .collect()
      )
    );
    return perStock.flat();
  },
});
