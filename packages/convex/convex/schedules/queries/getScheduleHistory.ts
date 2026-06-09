import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { vv } from "../../schema";

/** List recent research jobs created by a given schedule. */
export const getScheduleHistory = query({
  args: {
    scheduleId: vv.id("schedules"),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 20, 100);

    const jobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_scheduleId", (q) => q.eq("scheduleId", args.scheduleId))
      .order("desc")
      .take(maxResults);

    return jobs;
  },
});
