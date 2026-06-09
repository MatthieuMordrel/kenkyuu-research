import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** List the next upcoming runs across enabled schedules. */
export const getUpcomingRuns = query({
  args: {
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = args.limit ?? 10;

    // Use compound index to get only enabled schedules sorted by nextRunAt
    const enabledSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true))
      .order("asc")
      .take(maxResults);

    const upcoming = enabledSchedules
      .filter((s) => s.nextRunAt !== undefined)
      .map((s) => ({
        scheduleId: s._id,
        scheduleName: s.name,
        promptId: s.promptId,
        nextRunAt: s.nextRunAt!,
        timezone: s.timezone ?? "UTC",
      }));

    return upcoming;
  },
});
