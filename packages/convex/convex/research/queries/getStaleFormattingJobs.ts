import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { MAX_ACTIVE_JOBS_SCAN } from "../../researchConcurrency";

/** Returns formatting jobs whose format pass started before the cutoff. */
export const getStaleFormattingJobs = internalQuery({
  args: { staleThresholdMs: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.staleThresholdMs;
    const formattingJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "formatting"))
      .take(MAX_ACTIVE_JOBS_SCAN);

    return formattingJobs.filter((job) => {
      if (job.rawResult === undefined) return false;
      const started = job.formatStartedAt ?? job.createdAt;
      return started < cutoff;
    });
  },
});
