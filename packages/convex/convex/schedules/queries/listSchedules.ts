import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** List schedules (newest first) along with the global pause flag. */
export const listSchedules = query({
  args: {
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 200, 200);
    const schedules = await ctx.db
      .query("schedules")
      .order("desc")
      .take(maxResults);

    const globalPause = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();

    return {
      schedules,
      globalPaused: globalPause?.value === "true",
    };
  },
});
