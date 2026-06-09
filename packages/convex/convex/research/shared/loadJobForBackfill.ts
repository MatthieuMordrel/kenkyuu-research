import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";

/** Loads a job and asserts it is completed with a result, ready for reformatting. */
export async function loadJobForBackfill(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">
): Promise<{ _id: Id<"researchJobs">; status: string; result?: string }> {
  const job = await ctx.runQuery(
    internal.research.queries.internalGetJob.internalGetJob,
    { id: jobId }
  );
  if (!job) {
    throw new Error("Research job not found");
  }
  if (job.status !== "completed" || !job.result) {
    throw new Error("Job must be completed with a result to reformat");
  }
  return job;
}
