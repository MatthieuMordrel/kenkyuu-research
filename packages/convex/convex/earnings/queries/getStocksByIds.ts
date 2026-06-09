import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { vv } from "../../schema";

/** Fetch stock documents by id, dropping any that no longer exist. */
export const getStocksByIds = internalQuery({
  args: { stockIds: v.array(vv.id("stocks")) },
  handler: async (ctx, args) => {
    const stocks = await Promise.all(
      args.stockIds.map((stockId) => ctx.db.get(stockId))
    );
    return stocks.filter((stock) => stock !== null);
  },
});
