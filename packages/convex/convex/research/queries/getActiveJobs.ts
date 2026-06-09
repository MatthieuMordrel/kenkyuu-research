import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import {
  asConcurrencyJobs,
  buildAllProviderConcurrencySnapshots,
} from "../../researchConcurrency";
import { loadActiveJobsForConcurrency } from "../shared/loadActiveJobsForConcurrency";
import { loadDisplayActiveJobs } from "../shared/loadDisplayActiveJobs";

/** Returns active jobs for UI surfaces plus per-provider concurrency snapshots. */
export const getActiveJobs = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const concurrencyJobs = await loadActiveJobsForConcurrency(ctx);
    const jobs = await loadDisplayActiveJobs(ctx);
    const byProvider = buildAllProviderConcurrencySnapshots(
      asConcurrencyJobs(concurrencyJobs)
    );

    return {
      jobs,
      byProvider,
      count: jobs.length,
    };
  },
});
