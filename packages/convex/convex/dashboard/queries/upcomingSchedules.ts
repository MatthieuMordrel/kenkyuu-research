import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Upcoming scheduled runs sorted by next run time. */
export const upcomingSchedules = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const enabledSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true))
      .order("asc")
      .take(5);

    const upcoming = enabledSchedules
      .filter((s) => s.nextRunAt !== undefined)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        promptId: s.promptId,
        nextRunAt: s.nextRunAt!,
        cron: s.cron,
        timezone: s.timezone,
      }));

    const enriched = await Promise.all(
      upcoming.map(async (s) => {
        const prompt = await ctx.db.get(s.promptId);
        Object.assign(s, { promptName: prompt?.name ?? "Deleted prompt" });
        return s as typeof s & { promptName: string };
      })
    );

    return enriched;
  },
});
