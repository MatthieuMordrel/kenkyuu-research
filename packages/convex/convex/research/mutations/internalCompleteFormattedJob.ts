import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";
import { truncateResult } from "../../validation";
import { buildSearchTextForJob } from "../../researchJobSearchMetadata";
import { clearFormatTrackingFields } from "../shared/clearFormatTrackingFields";
import { scheduleProviderQueueDrain } from "../shared/scheduleProviderQueueDrain";

/** Writes the polished report and marks the job completed. */
export const internalCompleteFormattedJob = internalMutation({
  args: {
    id: vv.id("researchJobs"),
    result: v.string(),
    costUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    const result = truncateResult(args.result);
    const { searchText, title } = await buildSearchTextForJob(ctx, {
      promptId: job.promptId,
      stockIds: job.stockIds,
      resultMarkdown: result,
    });

    await ctx.db.patch(args.id, {
      status: "completed",
      result,
      title,
      searchText,
      costUsd: args.costUsd,
      completedAt: Date.now(),
      ...clearFormatTrackingFields,
    });

    await scheduleProviderQueueDrain(ctx, job.provider);
    return args.id;
  },
});
