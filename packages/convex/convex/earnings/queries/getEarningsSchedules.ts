import { internalQuery } from "../../_generated/server";

/** List enabled schedules of trigger type "earnings" that have an earnings config. */
export const getEarningsSchedules = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true))
      .take(200);

    return allSchedules.filter(
      (s) => s.triggerType === "earnings" && s.earningsConfig
    );
  },
});
