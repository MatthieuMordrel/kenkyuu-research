import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Whether schedules are globally paused. */
export const getGlobalPauseStatus = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();
    return setting?.value === "true";
  },
});
