import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { assertWithinBudget } from "../../costTracking/shared/assertWithinBudget";
import {
  jobFieldsForModel,
  modelIdValidator,
  providerValidator,
  resolveMutationModelId,
} from "../../providers/constants";
import { buildSearchTextForJob } from "../../researchJobSearchMetadata";

/** Creates a pending research job and immediately schedules its dispatch. */
export const createAndStartResearch = mutation({
  args: {
    promptId: vv.id("prompts"),
    stockIds: v.array(vv.id("stocks")),
    modelId: v.optional(modelIdValidator),
    provider: v.optional(providerValidator),
    scheduleId: v.optional(vv.id("schedules")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    await assertWithinBudget(ctx);

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    const resolvedModelId = resolveMutationModelId({
      modelId: args.modelId ?? prompt.defaultModelId,
      provider: args.provider ?? prompt.defaultProvider,
    });
    const { modelId, provider } = jobFieldsForModel(resolvedModelId);
    const now = Date.now();
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
      internal.research.actions.internalStartResearch.internalStartResearch,
      {
        jobId,
      }
    );

    return jobId;
  },
});
