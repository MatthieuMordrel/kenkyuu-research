import { internalQuery } from "../../_generated/server";

/** List all stocks (internal, used by schedule actions to resolve selections). */
export const listStocksInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stocks").collect();
  },
});
