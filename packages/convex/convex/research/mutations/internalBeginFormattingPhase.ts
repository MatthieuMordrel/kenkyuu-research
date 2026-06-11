import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";
import { truncateResult } from "../../validation";
import { customFieldValueValidator } from "../../customFields";
import { scheduleProviderQueueDrain } from "../shared/scheduleProviderQueueDrain";

/** Moves a job into the formatting phase after provider research finishes. */
export const internalBeginFormattingPhase = internalMutation({
  args: {
    id: vv.id("researchJobs"),
    rawResult: v.string(),
    customFieldValues: v.optional(v.array(customFieldValueValidator)),
    costUsd: v.number(),
    durationMs: v.number(),
    toolCallCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, {
      status: "formatting",
      rawResult: truncateResult(args.rawResult),
      customFieldValues: args.customFieldValues,
      costUsd: args.costUsd,
      durationMs: args.durationMs,
      toolCallCount: args.toolCallCount,
      externalJobId: undefined,
      formatExternalId: undefined,
      formatStartedAt: Date.now(),
      formatAttempts: 0,
    });

    await scheduleProviderQueueDrain(ctx, job.provider);
    return args.id;
  },
});
