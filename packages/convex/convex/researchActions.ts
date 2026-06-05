"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  estimateModelCost,
  getProviderAdapter,
  getSettingsKeyForProvider,
  resolveJobModel,
  RESEARCH_PROVIDERS,
  type PollResult,
  type ProviderName,
} from "./providers";
import type { ResearchModelDefinition } from "@repo/research-models/types";
import { BUDGET_REACHED_MESSAGE } from "./costTracking";
import {
  countSubmittedJobs,
  DISPATCH_RETRY_DELAY_MS,
  hasDispatchSlot,
  openAiStartStaggerMs,
} from "./researchConcurrency";

const MAX_RETRIES = 3;

/** Pause execution in Node actions (used for OpenAI start stagger). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Scheduled-poll cadence for providers without webhooks. Start aggressive,
// back off so long jobs don't burn scheduler invocations.
const POLL_INITIAL_DELAY_MS = 30_000;
const POLL_MAX_DELAY_MS = 5 * 60_000;
const POLL_BACKOFF = 1.5;
// Hard timeout after which a still-running job is marked failed.
const JOB_HARD_TIMEOUT_MS = 90 * 60_000;
// Stale threshold for the recovery cron (runs every 15 min).
const STALE_JOB_THRESHOLD_MS = 30 * 60_000;

// ---------------------------------------------------------------------------
// Provider key resolution
// ---------------------------------------------------------------------------

async function getProviderApiKey(
  ctx: ActionCtx,
  providerId: ProviderName
): Promise<string | null> {
  return await ctx.runQuery(internal.authHelpers.getSettingValue, {
    key: getSettingsKeyForProvider(providerId),
  });
}

function missingKeyMessage(providerId: ProviderName): string {
  return `${RESEARCH_PROVIDERS[providerId].label} API key not configured. Set it in Settings.`;
}

// ---------------------------------------------------------------------------
// Terminal bookkeeping — shared between webhook path and polling path
// ---------------------------------------------------------------------------

async function applyCompletedResult(
  ctx: ActionCtx,
  job: Doc<"researchJobs">,
  model: ResearchModelDefinition,
  result: Extract<PollResult, { status: "completed" }>
) {
  const costUsd = estimateModelCost(model, result.usage);
  const durationMs = Date.now() - job.createdAt;
  const toolCallCount = result.usage.toolCalls ?? result.usage.webSearchRequests;

  await ctx.runMutation(internal.researchJobs.beginFormattingPhase, {
    id: job._id,
    rawResult: result.text,
    costUsd,
    durationMs,
    toolCallCount,
  });

  await ctx.runMutation(internal.researchJobs.logCost, {
    jobId: job._id,
    provider: model.providerId,
    modelId: model.id,
    costUsd,
  });

  await ctx.scheduler.runAfter(0, internal.researchFormatActions.startFormat, {
    jobId: job._id,
    mode: "pipeline",
  });
}

async function applyFailedResult(
  ctx: ActionCtx,
  job: Doc<"researchJobs">,
  error: string,
  { retryable }: { retryable: boolean }
) {
  await ctx.runMutation(internal.researchJobs.updateJobStatus, {
    id: job._id,
    status: "failed",
    error,
  });

  if (retryable && job.attempts < MAX_RETRIES) {
    await ctx.scheduler.runAfter(
      Math.pow(2, job.attempts) * 5000,
      internal.researchActions.startResearch,
      { jobId: job._id }
    );
  } else {
    await ctx.scheduler.runAfter(
      0,
      internal.notifications.dispatchJobNotification,
      { jobId: job._id }
    );
  }
}

function isTerminal(status: Doc<"researchJobs">["status"]): boolean {
  return status === "completed" || status === "failed";
}

// ---------------------------------------------------------------------------
// startResearch — submit a pending job to its provider
// ---------------------------------------------------------------------------

export const startResearch = internalAction({
  args: { jobId: v.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.researchJobs.getJobInternal, {
      id: args.jobId,
    });
    if (!job) throw new Error("Research job not found");

    if (job.status === "running") {
      // Another startResearch invocation is already dispatching this job.
      return;
    }

    if (job.status !== "pending" && job.status !== "failed") {
      throw new Error(`Job is not in a startable state: ${job.status}`);
    }

    // Budget gate: stop new spend once the monthly budget is reached. This is the
    // single chokepoint every job passes through (manual starts, retries, queue
    // drains, and schedule-triggered jobs), so enforcing here covers them all.
    const budget = await ctx.runQuery(
      internal.costTracking.checkBudgetReachedInternal,
      {}
    );
    if (budget.reached) {
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "failed",
        error: BUDGET_REACHED_MESSAGE,
      });
      return;
    }

    const model = resolveJobModel(job);
    const activeJobs = await ctx.runQuery(
      internal.researchJobs.getConcurrencyJobsInternal,
      {}
    );

    // Provider-aware dispatch gate: re-queue when this provider is at capacity.
    if (!hasDispatchSlot(activeJobs, model.providerId)) {
      await ctx.scheduler.runAfter(
        DISPATCH_RETRY_DELAY_MS,
        internal.researchActions.startResearch,
        { jobId: args.jobId }
      );
      return;
    }

    const attempts = await ctx.runMutation(
      internal.researchJobs.incrementAttempts,
      { id: args.jobId }
    );
    if (attempts > MAX_RETRIES) {
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "failed",
        error: `Exceeded maximum retries (${MAX_RETRIES})`,
      });
      return;
    }

    await ctx.runMutation(internal.researchJobs.updateJobStatus, {
      id: args.jobId,
      status: "running",
    });

    if (model.providerId === "openai") {
      const submittedOpenAiCount = countSubmittedJobs(activeJobs, "openai");
      const staggerMs = openAiStartStaggerMs(submittedOpenAiCount);
      if (staggerMs > 0) {
        await sleep(staggerMs);
      }
    }

    const adapter = getProviderAdapter(model.providerId);
    const apiKey = await getProviderApiKey(ctx, model.providerId);
    if (!apiKey) {
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "failed",
        error: missingKeyMessage(model.providerId),
      });
      return;
    }

    const resolvedPrompt = await resolvePrompt(ctx, job);

    try {
      const { externalId, submittedPrompt } = await adapter.start(
        model,
        resolvedPrompt,
        apiKey
      );

      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "running",
        externalJobId: externalId,
        resolvedPrompt: submittedPrompt ?? resolvedPrompt,
      });

      // Models without webhooks need us to poll until they finish.
      if (model.completionMode === "polling") {
        await ctx.scheduler.runAfter(
          POLL_INITIAL_DELAY_MS,
          internal.researchActions.pollJob,
          { jobId: args.jobId, nextDelayMs: POLL_INITIAL_DELAY_MS }
        );
      }
    } catch (error) {
      await handleStartError(ctx, args.jobId, attempts, error);
    }
  },
});

/** Resolve {{STOCKS}} / {{TICKER}} / {{DATE}} variables in the job's template. */
async function resolvePrompt(
  ctx: ActionCtx,
  job: Doc<"researchJobs">
): Promise<string> {
  const stocks = await Promise.all(
    job.stockIds.map((id) =>
      ctx.runQuery(internal.researchJobs.getStockInternal, { id })
    )
  );
  const valid = stocks.filter((s): s is NonNullable<typeof s> => s !== null);
  const first = valid[0];

  return job.promptSnapshot
    .replaceAll(
      "{{STOCKS}}",
      valid.map((s) => `${s.ticker} (${s.companyName}, ${s.exchange})`).join(", ")
    )
    .replaceAll(
      "{{TICKER}}",
      first ? `${first.ticker} (${first.companyName}, ${first.exchange})` : ""
    )
    .replaceAll("{{DATE}}", new Date().toISOString().split("T")[0]!);
}

async function handleStartError(
  ctx: ActionCtx,
  jobId: Doc<"researchJobs">["_id"],
  attempts: number,
  error: unknown
) {
  const message = error instanceof Error ? error.message : "Unknown error";

  await ctx.runMutation(internal.researchJobs.updateJobStatus, {
    id: jobId,
    status: "failed",
    error: message,
  });

  if (attempts >= MAX_RETRIES) return;

  const delayMs = parseRetryDelayMs(message, attempts);
  await ctx.scheduler.runAfter(
    delayMs,
    internal.researchActions.startResearch,
    { jobId }
  );
}

/** Parse "try again in 404ms" / "try again in 6s" out of rate-limit errors. */
function parseRetryDelayMs(message: string, attempts: number): number {
  const isRateLimit = message.toLowerCase().includes("rate limit");
  if (isRateLimit) {
    const msMatch = message.match(/try again in (\d+)ms/i);
    const sMatch = message.match(/try again in ([\d.]+)s/i);
    const parsedMs = msMatch
      ? parseInt(msMatch[1]!, 10)
      : sMatch
        ? parseFloat(sMatch[1]!) * 1000
        : 0;
    return Math.max(parsedMs + 2000, 5000);
  }
  return Math.pow(2, attempts) * 5000;
}

// ---------------------------------------------------------------------------
// pollJob — provider-agnostic status check
// ---------------------------------------------------------------------------
// Called in three contexts:
//   1. Anthropic self-scheduled polling (providers with completionMode=polling)
//   2. OpenAI webhook handler (http.ts → processWebhookEvent → pollJob)
//   3. Recovery cron for stale jobs (all providers)
// ---------------------------------------------------------------------------

export const pollJob = internalAction({
  args: {
    jobId: v.id("researchJobs"),
    /** Only set when called from the polling loop; used to grow the backoff. */
    nextDelayMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(internal.researchJobs.getJobInternal, {
      id: args.jobId,
    });
    if (!job) return;

    // Idempotency: once terminal or formatting, nothing more to do.
    if (job.status === "formatting") return;
    if (isTerminal(job.status)) return;
    if (!job.externalJobId) return;

    const model = resolveJobModel(job);
    const adapter = getProviderAdapter(model.providerId);
    const apiKey = await getProviderApiKey(ctx, model.providerId);
    if (!apiKey) {
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "failed",
        error: missingKeyMessage(model.providerId),
      });
      return;
    }

    let result: PollResult;
    try {
      result = await adapter.poll(model, job.externalJobId, apiKey);
    } catch (error) {
      console.error(
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

/** If the job has run longer than the hard timeout, fail it; otherwise reschedule polling. */
async function maybeTimeoutOrReschedule(
  ctx: ActionCtx,
  job: Doc<"researchJobs">,
  currentDelayMs: number | undefined
) {
  if (Date.now() - job.createdAt > JOB_HARD_TIMEOUT_MS) {
    await applyFailedResult(
      ctx,
      job,
      `Job timed out after ${Math.round(JOB_HARD_TIMEOUT_MS / 60_000)} minutes`,
      { retryable: false }
    );
    return;
  }

  // Only the self-scheduling polling loop passes currentDelayMs. The webhook
  // handler and recovery cron invoke pollJob without it — they do their own
  // rescheduling.
  if (currentDelayMs === undefined) return;

  const nextDelayMs = Math.min(
    Math.round(currentDelayMs * POLL_BACKOFF),
    POLL_MAX_DELAY_MS
  );
  await ctx.scheduler.runAfter(
    nextDelayMs,
    internal.researchActions.pollJob,
    { jobId: job._id, nextDelayMs }
  );
}

// ---------------------------------------------------------------------------
// processWebhookEvent — OpenAI webhook entry point
// ---------------------------------------------------------------------------

export const processWebhookEvent = internalAction({
  args: {
    jobId: v.id("researchJobs"),
    eventType: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Webhook delivery can fire after we've already processed the job (e.g.
    // via the recovery cron). pollJob's own idempotency guard handles that.
    await ctx.runAction(internal.researchActions.pollJob, {
      jobId: args.jobId,
    });
  },
});

// ---------------------------------------------------------------------------
// recoverStaleJobs — cron every 15 min; catches dropped webhooks and stalled polls
// ---------------------------------------------------------------------------

export const recoverStaleJobs = internalAction({
  args: {},
  handler: async (ctx) => {
    const staleJobs = await ctx.runQuery(
      internal.researchJobs.getStaleRunningJobs,
      { staleThresholdMs: STALE_JOB_THRESHOLD_MS }
    );

    for (const job of staleJobs) {
      try {
        await ctx.runAction(internal.researchActions.pollJob, {
          jobId: job._id,
        });
      } catch (error) {
        console.error(
          `recoverStaleJobs: pollJob failed for ${job._id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  },
});

// ---------------------------------------------------------------------------
// checkJobHealth — user-facing liveness probe
// ---------------------------------------------------------------------------

interface HealthCheckResult {
  jobId: string;
  convexStatus: string;
  providerStatus: string | null;
  provider: ProviderName;
  message: string;
  elapsedMs?: number;
  checkedAt: number;
}

export const checkJobHealth = action({
  args: {
    jobId: v.id("researchJobs"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<HealthCheckResult> => {
    if (!args.token) throw new Error("Unauthorized");
    const session = await ctx.runQuery(
      internal.authHelpers.validateSessionInternal,
      { token: args.token }
    );
    if (!session.valid) throw new Error("Unauthorized");

    const job = await ctx.runQuery(internal.researchJobs.getJobInternal, {
      id: args.jobId,
    });
    if (!job) throw new Error("Research job not found");

    const jobId = args.jobId as string;
    const now = Date.now();

    if (!job.externalJobId) {
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: null,
        message:
          job.status === "pending"
            ? "Job is queued and has not been submitted yet."
            : "No external job ID found.",
        checkedAt: now,
      };
    }

    if (isTerminal(job.status)) {
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: job.status === "completed" ? "completed" : "failed",
        message: `Job already ${job.status}.`,
        checkedAt: now,
      };
    }

    const model = resolveJobModel(job);
    const adapter = getProviderAdapter(model.providerId);
    const apiKey = await getProviderApiKey(ctx, model.providerId);
    if (!apiKey) {
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: null,
        message: `${missingKeyMessage(model.providerId)} Cannot verify external status.`,
        checkedAt: now,
      };
    }

    try {
      const result = await adapter.poll(model, job.externalJobId, apiKey);
      const elapsedMs = now - job.createdAt;
      const elapsedMin = Math.floor(elapsedMs / 60_000);
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: result.status,
        elapsedMs,
        message: statusMessage(model, result, elapsedMin),
        checkedAt: now,
      };
    } catch (error) {
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: null,
        message: `Failed to check provider status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        checkedAt: now,
      };
    }
  },
});

function statusMessage(
  model: ResearchModelDefinition,
  result: PollResult,
  elapsedMin: number
): string {
  switch (result.status) {
    case "running":
      return `${model.label} is running (${elapsedMin}m elapsed). This is normal for deep research.`;
    case "completed":
      return `${model.label} reports completed — processing will follow shortly.`;
    case "failed":
      return `${model.label} reports failed: ${result.error}`;
    case "cancelled":
      return `${model.label} reports cancelled.`;
  }
}

// Re-export so existing test files can still import cost helpers.
export { estimateOpenAICost as estimateCost } from "./providers/openai";
