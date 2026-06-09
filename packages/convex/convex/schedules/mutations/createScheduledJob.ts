import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation } from "../../_generated/server";
import {
  jobFieldsForModel,
  providerValidator,
  resolveMutationModelId,
} from "../../providers/constants";
import { buildSearchTextForJob } from "../../researchJobSearchMetadata";
import { vv } from "../../schema";

/** Create a research job for a schedule run and kick off the research action. */
export const createScheduledJob = internalMutation({
  args: {
    promptId: vv.id("prompts"),
    stockIds: v.array(vv.id("stocks")),
    modelId: v.optional(v.string()),
    provider: providerValidator,
    scheduleId: vv.id("schedules"),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    const now = Date.now();
    const resolvedModelId = resolveMutationModelId({
      modelId: args.modelId,
      provider: args.provider,
    });
    const { modelId, provider } = jobFieldsForModel(resolvedModelId);
    const { searchText } = await buildSearchTextForJob(ctx, {
      promptId: args.promptId,
      stockIds: args.stockIds,
    });
    const jobId = await ctx.db.insert("researchJobs", {
      promptId: args.promptId,
      promptSnapshot: prompt.template,
      stockIds: args.stockIds,
      modelId,
      provider,
      status: "pending",
      attempts: 0,
      scheduleId: args.scheduleId,
      createdAt: now,
      searchText,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.research.actions.startResearch.startResearch,
      {
        jobId,
      }
    );

    return jobId;
  },
});
