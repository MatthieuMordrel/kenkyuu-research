"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";
import { logger } from "../../lib/logger";
import {
  DEFAULT_FORMAT_MODEL_ID,
  resolveFormatModel,
} from "@repo/research-models/format-models";
import { startFormatResponse } from "../../providers/formatOpenaiAdapter";
import { prepassResearchMarkdown } from "../../researchFormatPrepass";
import { completeFormatJob } from "../shared/completeFormatJob";
import { formatMode } from "../shared/formatMode";
import { FORMAT_POLL_INITIAL_DELAY_MS } from "../shared/formatPollInitialDelayMs";
import { getOpenAIApiKey } from "../shared/getOpenAIApiKey";
import { isPipelineJob } from "../shared/isPipelineJob";
import { loadJob } from "../shared/loadJob";
import { schedulePoll } from "../shared/schedulePoll";
import { sourceMarkdown } from "../shared/sourceMarkdown";

/**
 * Submits an OpenAI background format response or completes with prepass when no API key.
 */
export const startFormat = internalAction({
  args: {
    jobId: vv.id("researchJobs"),
    mode: formatMode,
  },
  handler: async (ctx, args): Promise<void> => {
    const job = await loadJob(ctx, args.jobId);
    if (!job) return;

    const markdown = sourceMarkdown(job);
    if (!markdown) return;

    if (args.mode === "pipeline" && !isPipelineJob(job)) return;
    if (args.mode === "backfill" && job.status !== "completed") return;

    if (job.formatExternalId) {
      await schedulePoll(
        ctx,
        args.jobId,
        args.mode,
        FORMAT_POLL_INITIAL_DELAY_MS
      );
      return;
    }

    const apiKey = await getOpenAIApiKey(ctx);
    const preprocessed = prepassResearchMarkdown(markdown);

    if (!apiKey) {
      await completeFormatJob(ctx, {
        job,
        resultText: preprocessed,
        formattingCostUsd: 0,
        usedFallback: true,
        mode: args.mode,
      });
      return;
    }

    const formatModel = resolveFormatModel(DEFAULT_FORMAT_MODEL_ID);

    try {
      const { externalId } = await startFormatResponse(
        formatModel,
        apiKey,
        preprocessed
      );
      await ctx.runMutation(
        internal.research.mutations.setFormatExternalId.setFormatExternalId,
        {
          id: args.jobId,
          formatExternalId: externalId,
        }
      );
      await schedulePoll(
        ctx,
        args.jobId,
        args.mode,
        FORMAT_POLL_INITIAL_DELAY_MS
      );
    } catch (error) {
      logger.error(
        `startFormat: OpenAI submit failed for ${args.jobId}:`,
        error instanceof Error ? error.message : error
      );
      await completeFormatJob(ctx, {
        job,
        resultText: preprocessed,
        formattingCostUsd: 0,
        usedFallback: true,
        mode: args.mode,
      });
    }
  },
});
