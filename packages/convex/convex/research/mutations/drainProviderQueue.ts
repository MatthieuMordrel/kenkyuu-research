import { internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { providerValidator } from "../../providers/constants";
import {
  asConcurrencyJobs,
  buildAllProviderConcurrencySnapshots,
} from "../../researchConcurrency";
import { loadActiveJobsForConcurrency } from "../shared/loadActiveJobsForConcurrency";

/**
 * Starts the oldest pending job for a provider when a dispatch slot is available.
 */
export const drainProviderQueue = internalMutation({
  args: { provider: providerValidator },
  handler: async (ctx, args) => {
    const activeJobs = await loadActiveJobsForConcurrency(ctx);
    const snapshot = buildAllProviderConcurrencySnapshots(
      asConcurrencyJobs(activeJobs)
    )[args.provider];

    if (!snapshot.hasDispatchSlot) {
      return null;
    }

    const pendingJobs = activeJobs
      .filter(
        (job) => job.provider === args.provider && job.status === "pending"
      )
      .toSorted((left, right) => left.createdAt - right.createdAt);

    const nextJob = pendingJobs[0];
    if (!nextJob) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.research.actions.startResearch.startResearch,
      {
        jobId: nextJob._id,
      }
    );

    return nextJob._id;
  },
});
