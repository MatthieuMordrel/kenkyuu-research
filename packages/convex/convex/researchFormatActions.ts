"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  DEFAULT_FORMAT_MODEL_ID,
  estimateFormatCost,
  resolveFormatModel,
} from "@repo/research-models/format-models";
import {
  pollFormatResponse,
  startFormatResponse,
} from "./providers/formatOpenaiAdapter";
import type { PollResult } from "./providers/types";
import { getSettingsKeyForProvider } from "./providers/constants";
import {
  evaluateFormattedOutput,
  MAX_FORMAT_ATTEMPTS,
} from "./researchFormatCore";
import { prepassResearchMarkdown } from "./researchFormatPrepass";

/** First poll after submit; matches research poll cadence. */
const FORMAT_POLL_INITIAL_DELAY_MS = 30_000;
const FORMAT_POLL_MAX_DELAY_MS = 5 * 60_000;
const FORMAT_POLL_BACKOFF = 1.5;
const FORMAT_STALE_THRESHOLD_MS = 20 * 60_000;
const FORMAT_HARD_TIMEOUT_MS = 60 * 60_000;

const formatMode = v.union(v.literal("pipeline"), v.literal("backfill"));

async function getOpenAIApiKey(ctx: ActionCtx): Promise<string | null> {
  return await ctx.runQuery(internal.authHelpers.getSettingValue, {
    key: getSettingsKeyForProvider("openai"),
  });
}

async function loadJob(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">
): Promise<Doc<"researchJobs"> | null> {
  return await ctx.runQuery(internal.researchJobs.getJobInternal, { id: jobId });
}

function isPipelineJob(job: Doc<"researchJobs">): boolean {
  return job.status === "formatting";
}

function sourceMarkdown(job: Doc<"researchJobs">): string | null {
  if (job.status === "formatting" && job.rawResult) {
    return job.rawResult;
  }
  if (job.status === "completed") {
    return job.rawResult ?? job.result ?? null;
  }
  return null;
}

async function schedulePoll(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">,
  mode: "pipeline" | "backfill",
  nextDelayMs: number
) {
  await ctx.scheduler.runAfter(nextDelayMs, internal.researchFormatActions.pollFormat, {
    jobId,
    mode,
    nextDelayMs,
  });
}

async function scheduleStart(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">,
  mode: "pipeline" | "backfill"
) {
  await ctx.scheduler.runAfter(0, internal.researchFormatActions.startFormat, {
    jobId,
    mode,
  });
}

async function dispatchPostCompleteSideEffects(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">,
  totalCostUsd: number
) {
  await ctx.scheduler.runAfter(0, internal.notifications.dispatchJobNotification, {
    jobId,
  });
  await ctx.scheduler.runAfter(0, internal.budgetAlert.checkBudgetAlert, {
    currentCostUsd: totalCostUsd,
  });
}

interface FormatCompletionArgs {
  job: Doc<"researchJobs">;
  resultText: string;
  formattingCostUsd: number;
  usedFallback: boolean;
  mode: "pipeline" | "backfill";
}

/**
 * Persists format output and logs formatter cost when the model pass succeeded.
 */
async function completeFormatJob(
  ctx: ActionCtx,
  args: FormatCompletionArgs
): Promise<void> {
  const formatModel = resolveFormatModel(DEFAULT_FORMAT_MODEL_ID);
  const researchCostUsd = args.job.costUsd ?? 0;

  if (!args.usedFallback && args.formattingCostUsd > 0) {
    await ctx.runMutation(internal.researchJobs.logCost, {
      jobId: args.job._id,
      provider: formatModel.providerId,
      modelId: formatModel.id,
      costUsd: args.formattingCostUsd,
    });
  }

  if (args.mode === "pipeline") {
    await ctx.runMutation(internal.researchJobs.completeFormattedJob, {
      id: args.job._id,
      result: args.resultText,
      costUsd: researchCostUsd + args.formattingCostUsd,
    });
    await dispatchPostCompleteSideEffects(
      ctx,
      args.job._id,
      researchCostUsd + args.formattingCostUsd
    );
    return;
  }

  const source = args.job.rawResult ?? args.job.result ?? args.resultText;
  await ctx.runMutation(internal.researchJobs.applyReformattedResult, {
    id: args.job._id,
    rawResult: source,
    result: args.resultText,
    additionalCostUsd: args.formattingCostUsd,
  });
}

/**
 * Submits an OpenAI background format response or completes with prepass when no API key.
 */
export const startFormat = internalAction({
  args: {
    jobId: v.id("researchJobs"),
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
      await schedulePoll(ctx, args.jobId, args.mode, FORMAT_POLL_INITIAL_DELAY_MS);
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
      await ctx.runMutation(internal.researchJobs.setFormatExternalId, {
        id: args.jobId,
        formatExternalId: externalId,
      });
      await schedulePoll(ctx, args.jobId, args.mode, FORMAT_POLL_INITIAL_DELAY_MS);
    } catch (error) {
      console.error(
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

async function handleFormatTimeout(
  ctx: ActionCtx,
  job: Doc<"researchJobs">,
  mode: "pipeline" | "backfill"
) {
  const markdown = sourceMarkdown(job);
  const preprocessed = prepassResearchMarkdown(markdown ?? "");
  await completeFormatJob(ctx, {
    job,
    resultText: preprocessed,
    formattingCostUsd: 0,
    usedFallback: true,
    mode,
  });
}

async function handlePollCompleted(
  ctx: ActionCtx,
  job: Doc<"researchJobs">,
  mode: "pipeline" | "backfill",
  result: Extract<PollResult, { status: "completed" }>
) {
  const markdown = sourceMarkdown(job);
  if (!markdown) return;

  const preprocessed = prepassResearchMarkdown(markdown);
  const formatModel = resolveFormatModel(DEFAULT_FORMAT_MODEL_ID);
  const formattingCostUsd = estimateFormatCost(formatModel, result.usage);
  const formatAttempts = job.formatAttempts ?? 0;

  const evaluation = evaluateFormattedOutput({
    preprocessed,
    formatted: result.text,
    formatAttempts,
  });

  if (evaluation.decision === "accept") {
    await completeFormatJob(ctx, {
      job,
      resultText: evaluation.text,
      formattingCostUsd,
      usedFallback: false,
      mode,
    });
    return;
  }

  if (evaluation.decision === "retry") {
    await ctx.runMutation(internal.researchJobs.incrementFormatAttempts, {
      id: job._id,
    });
    await ctx.runMutation(internal.researchJobs.clearFormatExternalId, {
      id: job._id,
    });
    await scheduleStart(ctx, job._id, mode);
    return;
  }

  await completeFormatJob(ctx, {
    job,
    resultText: evaluation.text,
    formattingCostUsd,
    usedFallback: true,
    mode,
  });
}

/**
 * Polls the OpenAI format response until done, failed, or timed out.
 */
export const pollFormat = internalAction({
  args: {
    jobId: v.id("researchJobs"),
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
      console.error(
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
        console.error(
          `pollFormat: response ${pollResult.status} for ${args.jobId}:`,
          pollResult.status === "failed" ? pollResult.error : "cancelled"
        );
        await handleFormatTimeout(ctx, job, args.mode);
        return;
      }
    }
  },
});

/**
 * Recovers jobs stuck in formatting (missed scheduler, deploy gap, etc.).
 */
export const recoverStaleFormatting = internalAction({
  args: {},
  handler: async (ctx) => {
    const staleJobs = await ctx.runQuery(
      internal.researchJobs.getStaleFormattingJobs,
      { staleThresholdMs: FORMAT_STALE_THRESHOLD_MS }
    );

    for (const job of staleJobs) {
      const mode = "pipeline" as const;
      try {
        if (job.formatExternalId) {
          await ctx.runAction(internal.researchFormatActions.pollFormat, {
            jobId: job._id,
            mode,
            nextDelayMs: FORMAT_POLL_INITIAL_DELAY_MS,
          });
        } else {
          await ctx.runAction(internal.researchFormatActions.startFormat, {
            jobId: job._id,
            mode,
          });
        }
      } catch (error) {
        console.error(
          `recoverStaleFormatting: failed for ${job._id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  },
});

/** @internal Exported for tests */
export const formatTiming = {
  FORMAT_POLL_INITIAL_DELAY_MS,
  FORMAT_HARD_TIMEOUT_MS,
  MAX_FORMAT_ATTEMPTS,
} as const;
