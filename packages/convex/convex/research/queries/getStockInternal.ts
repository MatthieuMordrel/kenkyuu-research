import { internalQuery } from "../../_generated/server";
import { vv } from "../../schema";

/** Returns a stock by id for internal callers. */
export const getStockInternal = internalQuery({
  args: { id: vv.id("stocks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
