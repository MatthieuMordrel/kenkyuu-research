import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";
import { providerValidator } from "../../providers/constants";

/** Records a provider cost entry for a research job. */
export const logCost = internalMutation({
  args: {
    jobId: vv.id("researchJobs"),
    provider: providerValidator,
    modelId: v.optional(v.string()),
    costUsd: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("costLogs", {
      jobId: args.jobId,
      provider: args.provider,
      modelId: args.modelId,
      costUsd: args.costUsd,
      timestamp: Date.now(),
    });
  },
});
