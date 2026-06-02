"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
/** @deprecated Use prepassResearchMarkdown from researchFormatPrepass */
export { prepassResearchMarkdown as prepassMarkdown } from "./researchFormatPrepass";

export {
  countMarkdownLinks,
  evaluateFormattedOutput,
  maxOutputTokensForInput,
  passesFormattingGuards,
  MAX_FORMAT_ATTEMPTS,
} from "./researchFormatCore";

interface ReformatStarted {
  jobId: string;
  status: "format_started";
}

async function loadJobForBackfill(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">
): Promise<{ _id: Id<"researchJobs">; status: string; result?: string }> {
  const job = await ctx.runQuery(internal.researchJobs.getJobInternal, {
    id: jobId,
  });
  if (!job) {
    throw new Error("Research job not found");
  }
  if (job.status !== "completed" || !job.result) {
    throw new Error("Job must be completed with a result to reformat");
  }
  return job;
}

/**
 * Re-runs the formatting pass on a completed job via async batch + poll.
 */
export const reformatResearchJob = internalAction({
  args: { jobId: v.id("researchJobs") },
  handler: async (ctx, args): Promise<ReformatStarted> => {
    await loadJobForBackfill(ctx, args.jobId);
    await ctx.runMutation(internal.researchJobs.beginBackfillFormat, {
      id: args.jobId,
    });
    await ctx.scheduler.runAfter(0, internal.researchFormatActions.startFormat, {
      jobId: args.jobId,
      mode: "backfill",
    });
    return { jobId: args.jobId, status: "format_started" };
  },
});

/**
 * Finds the latest completed research job for a ticker and starts async reformat.
 */
export const reformatByTicker = internalAction({
  args: { ticker: v.string() },
  handler: async (ctx, args): Promise<ReformatStarted> => {
    const jobId = await ctx.runQuery(
      internal.researchJobs.findLatestCompletedJobByTicker,
      { ticker: args.ticker.toUpperCase() }
    );
    if (!jobId) {
      throw new Error(
        `No completed research job found for ticker ${args.ticker}`
      );
    }
    await ctx.runMutation(internal.researchJobs.beginBackfillFormat, { id: jobId });
    await ctx.scheduler.runAfter(0, internal.researchFormatActions.startFormat, {
      jobId,
      mode: "backfill",
    });
    return { jobId, status: "format_started" };
  },
});
