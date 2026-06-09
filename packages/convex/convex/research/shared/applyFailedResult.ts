import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { MAX_RETRIES } from "./maxRetries";

/**
 * Terminal bookkeeping for a failed provider result — shared between the
 * webhook path and the polling path. Marks the job failed and either schedules
 * a retry or dispatches the failure notification.
 */
export async function applyFailedResult(
  ctx: ActionCtx,
  job: Doc<"researchJobs">,
  error: string,
  { retryable }: { retryable: boolean }
) {
  await ctx.runMutation(
    internal.research.mutations.updateJobStatus.updateJobStatus,
    {
      id: job._id,
      status: "failed",
      error,
    }
  );

  if (retryable && job.attempts < MAX_RETRIES) {
    await ctx.scheduler.runAfter(
      Math.pow(2, job.attempts) * 5000,
      internal.research.actions.startResearch.startResearch,
      { jobId: job._id }
    );
  } else {
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.actions.dispatchJobNotification
        .dispatchJobNotification,
      { jobId: job._id }
    );
  }
}
