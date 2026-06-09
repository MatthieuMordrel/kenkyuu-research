import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { MAX_ACTIVE_JOBS_SCAN } from "../../researchConcurrency";

/** Returns running jobs that have been running for longer than the given threshold. */
export const getStaleRunningJobs = internalQuery({
  args: { staleThresholdMs: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.staleThresholdMs;
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(MAX_ACTIVE_JOBS_SCAN);

    return runningJobs.filter(
      (job) => job.externalJobId && job.createdAt < cutoff
    );
  },
});
