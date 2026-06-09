"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";
import { loadJobForBackfill } from "../shared/loadJobForBackfill";
import type { ReformatStarted } from "../shared/reformatStarted";

/**
 * Re-runs the formatting pass on a completed job via async batch + poll.
 */
export const reformatResearchJob = internalAction({
  args: { jobId: vv.id("researchJobs") },
  handler: async (ctx, args): Promise<ReformatStarted> => {
    await loadJobForBackfill(ctx, args.jobId);
    await ctx.runMutation(
      internal.research.mutations.beginBackfillFormat.beginBackfillFormat,
      { id: args.jobId }
    );
    await ctx.scheduler.runAfter(
      0,
      internal.research.actions.startFormat.startFormat,
      {
        jobId: args.jobId,
        mode: "backfill",
      }
    );
    return { jobId: args.jobId, status: "format_started" };
  },
});
