"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { vv } from "../../schema";
import { logger } from "../../lib/logger";
import { pollFormatResponse } from "../../providers/formatOpenaiAdapter";
import type { PollResult } from "../../providers/types";
import { formatMode } from "../shared/formatMode";
import { getOpenAIApiKey } from "../shared/getOpenAIApiKey";
import { handleFormatTimeout } from "../shared/handleFormatTimeout";
import { handlePollCompleted } from "../shared/handlePollCompleted";
import { loadJob } from "../shared/loadJob";
import { schedulePoll } from "../shared/schedulePoll";

const FORMAT_POLL_MAX_DELAY_MS = 5 * 60_000;
const FORMAT_POLL_BACKOFF = 1.5;
const FORMAT_HARD_TIMEOUT_MS = 60 * 60_000;

/**
 * Polls the OpenAI format response until done, failed, or timed out.
 */
export const internalPollFormat = internalAction({
  args: {
    jobId: vv.id("researchJobs"),
    mode: formatMode,
    nextDelayMs: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const job = await loadJob(ctx, args.jobId);
    if (!job) return;

    if (args.mode === "pipeline" && job.status !== "formatting") return;
    if (args.mode === "backfill" && job.status !== "completed") return;
    if (!job.formatExternalId) return;

    const formatStartedAt = job.formatStartedAt ?? job.createdAt;
    if (Date.now() - formatStartedAt > FORMAT_HARD_TIMEOUT_MS) {
      await handleFormatTimeout(ctx, job, args.mode);
      return;
    }

    const apiKey = await getOpenAIApiKey(ctx);
    if (!apiKey) {
      await handleFormatTimeout(ctx, job, args.mode);
      return;
    }

    let pollResult: PollResult;
    try {
      pollResult = await pollFormatResponse(apiKey, job.formatExternalId);
    } catch (error) {
      logger.error(
        `pollFormat: poll failed for ${args.jobId}:`,
        error instanceof Error ? error.message : error
      );
      const nextDelayMs = Math.min(
        Math.round(args.nextDelayMs * FORMAT_POLL_BACKOFF),
        FORMAT_POLL_MAX_DELAY_MS
      );
      await schedulePoll(ctx, args.jobId, args.mode, nextDelayMs);
      return;
    }

    switch (pollResult.status) {
      case "running": {
        const nextDelayMs = Math.min(
          Math.round(args.nextDelayMs * FORMAT_POLL_BACKOFF),
          FORMAT_POLL_MAX_DELAY_MS
        );
        await schedulePoll(ctx, args.jobId, args.mode, nextDelayMs);
        return;
      }
      case "completed":
        await handlePollCompleted(ctx, job, args.mode, pollResult);
        return;
      case "failed":
      case "cancelled": {
        logger.error(
          `pollFormat: response ${pollResult.status} for ${args.jobId}:`,
          pollResult.status === "failed" ? pollResult.error : "cancelled"
        );
        await handleFormatTimeout(ctx, job, args.mode);
        return;
      }
    }
  },
});
