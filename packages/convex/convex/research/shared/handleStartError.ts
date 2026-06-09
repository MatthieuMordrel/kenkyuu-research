import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { MAX_RETRIES } from "./maxRetries";
import { parseRetryDelayMs } from "./parseRetryDelayMs";

/** Marks a job failed after a provider submit error and schedules a retry when allowed. */
export async function handleStartError(
  ctx: ActionCtx,
  jobId: Doc<"researchJobs">["_id"],
  attempts: number,
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Unknown error";

  await ctx.runMutation(
    internal.research.mutations.internalUpdateJobStatus.internalUpdateJobStatus,
    {
      id: jobId,
      status: "failed",
      error: message,
    }
  );

  if (attempts >= MAX_RETRIES) return;

  const delayMs = parseRetryDelayMs(message, attempts);
  await ctx.scheduler.runAfter(
    delayMs,
    internal.research.actions.internalStartResearch.internalStartResearch,
    { jobId }
  );
}
