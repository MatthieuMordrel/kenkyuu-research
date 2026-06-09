import type { QueryCtx } from "../../_generated/server";
import { MAX_ACTIVE_JOBS_SCAN } from "../../researchConcurrency";

/** Loads jobs in the post-research formatting pass (not counted toward provider concurrency). */
export async function loadFormattingJobs(ctx: QueryCtx) {
  return await ctx.db
    .query("researchJobs")
    .withIndex("by_status", (q) => q.eq("status", "formatting"))
    .take(MAX_ACTIVE_JOBS_SCAN);
}
