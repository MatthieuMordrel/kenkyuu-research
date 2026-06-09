"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";
import { logger } from "../../lib/logger";
import {
  getHarnessAdapter,
  resolveJobModel,
  type PollResult,
} from "../../providers";
import { applyCompletedResult } from "../shared/applyCompletedResult";
import { applyFailedResult } from "../shared/applyFailedResult";
import { getProviderApiKey } from "../shared/getProviderApiKey";
import { isTerminal } from "../shared/isTerminal";
import { maybeTimeoutOrReschedule } from "../shared/maybeTimeoutOrReschedule";
import { missingKeyMessage } from "../shared/missingKeyMessage";

/**
 * Provider-agnostic status check.
 *
 * Called in three contexts:
 *   1. Anthropic self-scheduled polling (providers with completionMode=polling)
 *   2. OpenAI webhook handler (http.ts → processWebhookEvent → pollJob)
 *   3. Recovery cron for stale jobs (all providers)
 */
export const pollJob = internalAction({
  args: {
    jobId: vv.id("researchJobs"),
    /** Only set when called from the polling loop; used to grow the backoff. */
    nextDelayMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(
      internal.research.queries.getJobInternal.getJobInternal,
      { id: args.jobId }
    );
    if (!job) return;

    // Idempotency: once terminal or formatting, nothing more to do.
    if (job.status === "formatting") return;
    if (isTerminal(job.status)) return;
    if (!job.externalJobId) return;

    const model = resolveJobModel(job);
    const adapter = getHarnessAdapter(model);
    const apiKey = await getProviderApiKey(ctx, model.providerId);
    if (!apiKey) {
      await ctx.runMutation(
        internal.research.mutations.updateJobStatus.updateJobStatus,
        {
          id: args.jobId,
          status: "failed",
          error: missingKeyMessage(model.providerId),
        }
      );
      return;
    }

    let result: PollResult;
    try {
      result = await adapter.poll(model, job.externalJobId, apiKey);
    } catch (error) {
      logger.error(
        `pollJob: ${model.id} poll failed for ${args.jobId}:`,
        error instanceof Error ? error.message : error
      );
      // Transient: keep the job alive unless it's older than the hard timeout.
      await maybeTimeoutOrReschedule(ctx, job, args.nextDelayMs);
      return;
    }

    switch (result.status) {
      case "completed":
        await applyCompletedResult(ctx, job, model, result);
        return;
      case "failed":
        await applyFailedResult(ctx, job, result.error, { retryable: true });
        return;
      case "cancelled":
        await applyFailedResult(ctx, job, `Research cancelled`, {
          retryable: false,
        });
        return;
      case "running":
        await maybeTimeoutOrReschedule(ctx, job, args.nextDelayMs);
        return;
    }
  },
});
