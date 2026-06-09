import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Latest completed research job that includes the given stock ticker (for backfill).
 */
export const internalFindLatestCompletedJobByTicker = internalQuery({
  args: { ticker: v.string() },
  handler: async (ctx, args) => {
    const stock = await ctx.db
      .query("stocks")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker))
      .first();

    if (!stock) {
      return null;
    }

    const completedJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(100);

    const match = completedJobs.find((job) => job.stockIds.includes(stock._id));
    return match?._id ?? null;
  },
});
