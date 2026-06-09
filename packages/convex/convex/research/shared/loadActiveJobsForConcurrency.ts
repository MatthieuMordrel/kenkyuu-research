import type { QueryCtx } from "../../_generated/server";
import { MAX_ACTIVE_JOBS_SCAN } from "../../researchConcurrency";

/** Loads pending and running jobs for concurrency calculations. */
export async function loadActiveJobsForConcurrency(ctx: QueryCtx) {
  const pendingJobs = await ctx.db
    .query("researchJobs")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .take(MAX_ACTIVE_JOBS_SCAN);
  const runningJobs = await ctx.db
    .query("researchJobs")
    .withIndex("by_status", (q) => q.eq("status", "running"))
    .take(MAX_ACTIVE_JOBS_SCAN);

  return [...pendingJobs, ...runningJobs];
}
