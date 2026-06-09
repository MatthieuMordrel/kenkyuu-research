import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";

/** Schedules an immediate startFormat invocation for the job. */
export async function scheduleStart(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">,
  mode: "pipeline" | "backfill"
) {
  await ctx.scheduler.runAfter(
    0,
    internal.research.actions.startFormat.startFormat,
    {
      jobId,
      mode,
    }
  );
}
