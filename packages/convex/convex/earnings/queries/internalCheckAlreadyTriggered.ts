import { internalQuery } from "../../_generated/server";
import { vv } from "../../schema";

/** Whether a (schedule, earnings) pair has already produced a triggered run. */
export const internalCheckAlreadyTriggered = internalQuery({
  args: {
    scheduleId: vv.id("schedules"),
    earningsId: vv.id("earnings"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("earningsTriggeredRuns")
      .withIndex("by_schedule_earnings", (q) =>
        q.eq("scheduleId", args.scheduleId).eq("earningsId", args.earningsId)
      )
      .first();
    return existing !== null;
  },
});
