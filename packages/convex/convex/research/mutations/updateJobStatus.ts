import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";
import { truncateResult } from "../../validation";
import { jobStatus } from "../shared/jobStatus";
import { scheduleProviderQueueDrain } from "../shared/scheduleProviderQueueDrain";

/** Patches job status plus optional result/cost fields, draining the provider queue on terminal transitions. */
export const updateJobStatus = internalMutation({
  args: {
    id: vv.id("researchJobs"),
    status: jobStatus,
    externalJobId: v.optional(v.string()),
    resolvedPrompt: v.optional(v.string()),
    rawResult: v.optional(v.string()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    costUsd: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const job = await ctx.db.get(id);
    if (!job) {
      throw new Error("Research job not found");
    }

    const patch: Record<string, unknown> = { status: updates.status };

    if (updates.externalJobId !== undefined)
      patch.externalJobId = updates.externalJobId;
    if (updates.resolvedPrompt !== undefined)
      patch.resolvedPrompt = updates.resolvedPrompt;
    if (updates.rawResult !== undefined)
      patch.rawResult = truncateResult(updates.rawResult);
    if (updates.result !== undefined)
      patch.result = truncateResult(updates.result);
    if (updates.error !== undefined) patch.error = updates.error;
    if (updates.costUsd !== undefined) patch.costUsd = updates.costUsd;
    if (updates.durationMs !== undefined) patch.durationMs = updates.durationMs;

    if (updates.status === "completed" || updates.status === "failed") {
      patch.completedAt = Date.now();
    }

    // Clear error and completedAt when a retry moves the job back to running
    if (updates.status === "running") {
      patch.error = undefined;
      patch.completedAt = undefined;
    }

    await ctx.db.patch(id, patch);

    if (
      updates.status === "completed" ||
      updates.status === "failed" ||
      updates.status === "formatting"
    ) {
      await scheduleProviderQueueDrain(ctx, job.provider);
    }

    return id;
  },
});
