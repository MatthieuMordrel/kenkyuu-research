"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { ReformatStarted } from "../shared/reformatStarted";

/**
 * Finds the latest completed research job for a ticker and starts async reformat.
 */
export const reformatByTicker = internalAction({
  args: { ticker: v.string() },
  handler: async (ctx, args): Promise<ReformatStarted> => {
    const jobId = await ctx.runQuery(
      internal.research.queries.findLatestCompletedJobByTicker
        .findLatestCompletedJobByTicker,
      { ticker: args.ticker.toUpperCase() }
    );
    if (!jobId) {
      throw new Error(
        `No completed research job found for ticker ${args.ticker}`
      );
    }
    await ctx.runMutation(
      internal.research.mutations.beginBackfillFormat.beginBackfillFormat,
      { id: jobId }
    );
    await ctx.scheduler.runAfter(
      0,
      internal.research.actions.startFormat.startFormat,
      {
        jobId,
        mode: "backfill",
      }
    );
    return { jobId, status: "format_started" };
  },
});
