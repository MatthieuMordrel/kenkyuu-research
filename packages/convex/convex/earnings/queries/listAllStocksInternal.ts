import { internalQuery } from "../../_generated/server";

/** List every stock document (internal use, e.g. earnings fetch). */
export const listAllStocksInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stocks").collect();
  },
});
