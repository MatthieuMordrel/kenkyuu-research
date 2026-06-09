import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";
import { truncateResult } from "../../validation";
import { buildSearchTextForJob } from "../../researchJobSearchMetadata";
import { clearFormatTrackingFields } from "../shared/clearFormatTrackingFields";

/** Updates a completed job after a backfill formatting pass. */
export const applyReformattedResult = internalMutation({
  args: {
    id: vv.id("researchJobs"),
    rawResult: v.string(),
    result: v.string(),
    additionalCostUsd: v.number(),
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
      rawResult: truncateResult(args.rawResult),
      result,
      title,
      searchText,
      costUsd: (job.costUsd ?? 0) + args.additionalCostUsd,
      ...clearFormatTrackingFields,
    });

    return args.id;
  },
});
