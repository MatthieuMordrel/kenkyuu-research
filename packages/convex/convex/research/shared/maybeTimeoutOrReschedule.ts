"use node";

import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { resolveJobModel } from "../../providers";
import { applyFailedResult } from "./applyFailedResult";
import { jobHardTimeoutMs } from "./jobHardTimeoutMs";

// Scheduled-poll cadence for providers without webhooks. Start aggressive,
// back off so long jobs don't burn scheduler invocations.
const POLL_MAX_DELAY_MS = 5 * 60_000;
const POLL_BACKOFF = 1.5;

/** If the job has run longer than the hard timeout, fail it; otherwise reschedule polling. */
export async function maybeTimeoutOrReschedule(
  ctx: ActionCtx,
  job: Doc<"researchJobs">,
  currentDelayMs: number | undefined
) {
  const timeoutMs = jobHardTimeoutMs(resolveJobModel(job));
  if (Date.now() - job.createdAt > timeoutMs) {
    await applyFailedResult(
      ctx,
      job,
      `Job timed out after ${Math.round(timeoutMs / 60_000)} minutes`,
      { retryable: false }
    );
    return;
  }

  // Only the self-scheduling polling loop passes currentDelayMs. The webhook
  // handler and recovery cron invoke pollJob without it — they do their own
  // rescheduling.
  if (currentDelayMs === undefined) return;

  const nextDelayMs = Math.min(
    Math.round(currentDelayMs * POLL_BACKOFF),
    POLL_MAX_DELAY_MS
  );
  await ctx.scheduler.runAfter(
    nextDelayMs,
    internal.research.actions.internalPollJob.internalPollJob,
    {
      jobId: job._id,
      nextDelayMs,
    }
  );
}
