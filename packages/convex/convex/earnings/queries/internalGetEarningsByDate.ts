import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/** List all earnings entries on a given date (YYYY-MM-DD). */
export const internalGetEarningsByDate = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("earnings")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});
