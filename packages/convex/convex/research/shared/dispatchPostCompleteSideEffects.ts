import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";

/** Fires the completion notification and budget-alert check for a finished job. */
export async function dispatchPostCompleteSideEffects(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">,
  totalCostUsd: number
) {
  await ctx.scheduler.runAfter(
    0,
    internal.notifications.actions.internalDispatchJobNotification
      .internalDispatchJobNotification,
    {
      jobId,
    }
  );
  await ctx.scheduler.runAfter(
    0,
    internal.costTracking.actions.internalCheckBudgetAlert
      .internalCheckBudgetAlert,
    {
      currentCostUsd: totalCostUsd,
    }
  );
}
