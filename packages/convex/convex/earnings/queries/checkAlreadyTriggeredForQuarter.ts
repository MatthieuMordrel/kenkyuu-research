import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { vv } from "../../schema";

/** Whether a schedule has already triggered for a given fiscal quarter key. */
export const checkAlreadyTriggeredForQuarter = internalQuery({
  args: {
    scheduleId: vv.id("schedules"),
    quarterKey: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("earningsTriggeredRuns")
      .withIndex("by_schedule_quarter", (q) =>
        q.eq("scheduleId", args.scheduleId).eq("quarterKey", args.quarterKey)
      )
      .first();
    return existing !== null;
  },
});
