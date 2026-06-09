import { internalQuery } from "../../_generated/server";

/** Whether schedules are globally paused (internal, no auth). */
export const getGlobalPauseStatusInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();
    return setting?.value === "true";
  },
});
