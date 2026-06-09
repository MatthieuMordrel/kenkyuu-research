import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";

/** Schedules the next pollFormat invocation after the given delay. */
export async function schedulePoll(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">,
  mode: "pipeline" | "backfill",
  nextDelayMs: number
) {
  await ctx.scheduler.runAfter(
    nextDelayMs,
    internal.research.actions.internalPollFormat.internalPollFormat,
    {
      jobId,
      mode,
      nextDelayMs,
    }
  );
}
