"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const MAX_RETRIES = 3;

async function getOpenAIClient(
  ctx: { runQuery: (ref: typeof internal.authHelpers.getSettingValue, args: { key: string }) => Promise<string | null> },
): Promise<OpenAI | null> {
  const apiKey = await ctx.runQuery(internal.authHelpers.getSettingValue, {
    key: "openai_api_key",
  });
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

// o3-deep-research pricing: Input $10/1M tokens, Output $40/1M tokens
/** @internal Exported for testing */
export function estimateCost(usage: OpenAI.Responses.ResponseUsage | undefined): number | undefined {
  if (!usage) return undefined;
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  return (inputTokens * 10 + outputTokens * 40) / 1_000_000;
}

export const processWebhookEvent = internalAction({
  args: {
    jobId: v.id("researchJobs"),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.researchJobs.getJobInternal, {
      id: args.jobId,
    });
    if (!job || !job.externalJobId) {
      throw new Error("Research job not found or missing external ID");
    }

    // Idempotency guard: skip if the job has already reached a terminal state.
    // Duplicate webhook deliveries would otherwise insert extra rows into costLogs.
    if (job.status === "completed" || (job.status === "failed" && args.eventType === "response.completed")) {
      return;
    }

    const client = await getOpenAIClient(ctx);
    if (!client) {
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "failed",
        error: "OpenAI API key not configured. Set it in Settings.",
      });
      return;
    }

    // Fetch the full response from OpenAI using the SDK
    const response = await client.responses.retrieve(job.externalJobId);

    if (
      args.eventType === "response.completed" &&
      response.status === "completed"
    ) {
      const outputContent = response.output_text;
      const durationMs = Date.now() - job.createdAt;
      const costUsd = estimateCost(response.usage);

      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "completed",
        result: outputContent,
        costUsd,
        durationMs,
      });

      // Log cost
      if (costUsd !== undefined) {
        await ctx.runMutation(internal.researchJobs.logCost, {
          jobId: args.jobId,
          provider: "openai",
          costUsd,
        });
      }

      // Dispatch notifications
      await ctx.scheduler.runAfter(
        0,
        internal.notifications.dispatchJobNotification,
        { jobId: args.jobId },
      );

      // Check budget alert
      if (costUsd !== undefined) {
        await ctx.scheduler.runAfter(
          0,
          internal.budgetAlert.checkBudgetAlert,
          { currentCostUsd: costUsd },
        );
      }
    } else if (
      args.eventType === "response.failed" ||
      args.eventType === "response.cancelled" ||
      response.status === "failed" ||
      response.status === "cancelled"
    ) {
      const error =
        response.error?.message ?? `Research ${response.status ?? args.eventType}`;

      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "failed",
        error,
      });

      // Trigger retry if under max attempts
      if (response.status === "failed" && job.attempts < 3) {
        await ctx.scheduler.runAfter(
          Math.pow(2, job.attempts) * 5000,
          internal.researchActions.startResearch,
          { jobId: args.jobId },
        );
      } else {
        await ctx.scheduler.runAfter(
          0,
          internal.notifications.dispatchJobNotification,
          { jobId: args.jobId },
        );
      }
    }
  },
});

const STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Cron-driven recovery for stale "running" jobs.
 * Polls OpenAI for the actual status of any job that has been running longer
 * than the threshold and processes the result — exactly as the webhook would.
 */
export const recoverStaleJobs = internalAction({
  args: {},
  handler: async (ctx) => {
    const staleJobs = await ctx.runQuery(
      internal.researchJobs.getStaleRunningJobs,
      { staleThresholdMs: STALE_JOB_THRESHOLD_MS },
    );

    if (staleJobs.length === 0) return;

    const client = await getOpenAIClient(ctx);
    if (!client) {
      console.error("recoverStaleJobs: OpenAI API key not configured");
      return;
    }

    for (const job of staleJobs) {
      try {
        const response = await client.responses.retrieve(job.externalJobId!);

        if (response.status === "completed") {
          await ctx.runAction(internal.researchActions.processWebhookEvent, {
            jobId: job._id,
            eventType: "response.completed",
          });
          console.log(`recoverStaleJobs: recovered completed job ${job._id}`);
        } else if (
          response.status === "failed" ||
          response.status === "cancelled"
        ) {
          await ctx.runAction(internal.researchActions.processWebhookEvent, {
            jobId: job._id,
            eventType: `response.${response.status}`,
          });
          console.log(
            `recoverStaleJobs: recovered ${response.status} job ${job._id}`,
          );
        } else if (response.status === "in_progress" || response.status === "queued") {
          // Still running on OpenAI's side — leave it alone.
          // If it's been too long (>90 minutes), mark as failed to unblock the queue.
          const ninetyMinutes = 90 * 60 * 1000;
          if (Date.now() - job.createdAt > ninetyMinutes) {
            await ctx.runMutation(internal.researchJobs.updateJobStatus, {
              id: job._id,
              status: "failed",
              error: "Job timed out after 90 minutes with no result from OpenAI",
            });
            await ctx.scheduler.runAfter(
              0,
              internal.notifications.dispatchJobNotification,
              { jobId: job._id },
            );
            console.log(`recoverStaleJobs: timed out job ${job._id}`);
          }
        }
      } catch (error) {
        console.error(
          `recoverStaleJobs: failed to check job ${job._id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  },
});

/**
 * Public action: checks the health of a running job by polling OpenAI directly.
 * Returns the OpenAI-side status so the user can confirm the job is progressing.
 */
interface HealthCheckResult {
  jobId: string;
  convexStatus: string;
  openaiStatus: string | null;
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
    // Validate auth
    if (!args.token) throw new Error("Unauthorized");
    const session = await ctx.runQuery(
      internal.authHelpers.validateSessionInternal,
      { token: args.token },
    );
    if (!session.valid) throw new Error("Unauthorized");

    const job = await ctx.runQuery(internal.researchJobs.getJobInternal, {
      id: args.jobId,
    });
    if (!job) throw new Error("Research job not found");

    const jobId = args.jobId as string;

    // If no external ID yet, job hasn't been submitted to OpenAI
    if (!job.externalJobId) {
      return {
        jobId,
        convexStatus: job.status as string,
        openaiStatus: null,
        message:
          job.status === "pending"
            ? "Job is queued and has not been submitted to OpenAI yet."
            : "No external job ID found.",
        checkedAt: Date.now(),
      };
    }

    // If job is already terminal, no need to poll OpenAI
    if (job.status === "completed" || job.status === "failed") {
      return {
        jobId,
        convexStatus: job.status as string,
        openaiStatus: job.status === "completed" ? "completed" : "failed",
        message: `Job already ${job.status}.`,
        checkedAt: Date.now(),
      };
    }

    const client = await getOpenAIClient(ctx);
    if (!client) {
      return {
        jobId,
        convexStatus: job.status as string,
        openaiStatus: null,
        message: "OpenAI API key not configured. Cannot verify external status.",
        checkedAt: Date.now(),
      };
    }

    try {
      const response = await client.responses.retrieve(job.externalJobId);
      const elapsedMs = Date.now() - job.createdAt;
      const elapsedMin = Math.floor(elapsedMs / 60_000);

      let message: string;
      if (response.status === "in_progress" || response.status === "queued") {
        message = `Job is ${response.status} on OpenAI (running for ${elapsedMin}m). This is normal for o3-deep-research.`;
      } else if (response.status === "completed") {
        message = `OpenAI reports completed — webhook may be pending. Recovery cron will pick it up within 15 minutes.`;
      } else {
        message = `OpenAI status: ${response.status}`;
      }

      return {
        jobId,
        convexStatus: job.status as string,
        openaiStatus: (response.status as string) ?? null,
        elapsedMs,
        message,
        checkedAt: Date.now(),
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : "Unknown error";
      return {
        jobId,
        convexStatus: job.status as string,
        openaiStatus: null,
        message: `Failed to check OpenAI status: ${errMsg}`,
        checkedAt: Date.now(),
      };
    }
  },
});

export const startResearch = internalAction({
  args: {
    jobId: v.id("researchJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.researchJobs.getJobInternal, {
      id: args.jobId,
    });
    if (!job) {
      throw new Error("Research job not found");
    }

    if (job.status !== "pending" && job.status !== "failed") {
      throw new Error(`Job is not in a startable state: ${job.status}`);
    }

    // Pre-flight: check how many jobs are already running on OpenAI.
    // If we're at the limit, re-queue with a delay instead of submitting immediately.
    const MAX_RUNNING = 3;
    const runningJobs = await ctx.runQuery(
      internal.researchJobs.getRunningJobCount,
      {},
    );
    if (runningJobs >= MAX_RUNNING) {
      // Re-queue this job to try again in 30 seconds
      console.log(
        `startResearch: ${MAX_RUNNING} jobs already running, re-queuing ${args.jobId} in 30s`,
      );
      await ctx.scheduler.runAfter(
        30_000,
        internal.researchActions.startResearch,
        { jobId: args.jobId },
      );
      return;
    }

    // Increment attempts
    const attempts = await ctx.runMutation(
      internal.researchJobs.incrementAttempts,
      { id: args.jobId },
    );

    if (attempts > MAX_RETRIES) {
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "failed",
        error: `Exceeded maximum retries (${MAX_RETRIES})`,
      });
      return;
    }

    // Update status to running
    await ctx.runMutation(internal.researchJobs.updateJobStatus, {
      id: args.jobId,
      status: "running",
    });

    // Resolve stock tickers for prompt variable injection
    const stocks = await Promise.all(
      job.stockIds.map((stockId) =>
        ctx.runQuery(internal.researchJobs.getStockInternal, { id: stockId }),
      ),
    );
    const validStocks = stocks.filter(
      (s): s is NonNullable<typeof s> => s !== null,
    );
    const stockTickers = validStocks.map((s) => s.ticker);

    // Build the final prompt with variable injection
    let resolvedPrompt = job.promptSnapshot;
    resolvedPrompt = resolvedPrompt.replaceAll(
      "{{STOCKS}}",
      validStocks
        .map((s) => `${s.ticker} (${s.companyName}, ${s.exchange})`)
        .join(", "),
    );
    const firstStock = validStocks[0];
    resolvedPrompt = resolvedPrompt.replaceAll(
      "{{TICKER}}",
      firstStock
        ? `${firstStock.ticker} (${firstStock.companyName}, ${firstStock.exchange})`
        : "",
    );
    resolvedPrompt = resolvedPrompt.replaceAll(
      "{{DATE}}",
      new Date().toISOString().split("T")[0]!,
    );

    const client = await getOpenAIClient(ctx);
    if (!client) {
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "failed",
        error: "OpenAI API key not configured. Set it in Settings.",
      });
      return;
    }

    try {
      const response = await client.responses.create({
        model: "o3-deep-research",
        input: resolvedPrompt,
        tools: [{ type: "web_search_preview" }],
        background: true,
      });

      // Store the external job ID for webhook matching
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "running",
        externalJobId: response.id,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";

      // If under max retries, schedule a retry
      if (attempts < MAX_RETRIES) {
        // Parse rate limit delay from error (e.g. "Please try again in 404ms" or "in 6s")
        const isRateLimit = message.toLowerCase().includes("rate limit");
        let delayMs: number;
        if (isRateLimit) {
          const msMatch = message.match(/try again in (\d+)ms/i);
          const sMatch = message.match(/try again in ([\d.]+)s/i);
          const parsedMs = msMatch
            ? parseInt(msMatch[1]!, 10)
            : sMatch
              ? parseFloat(sMatch[1]!) * 1000
              : 0;
          // Use parsed delay + generous buffer, minimum 5 seconds
          delayMs = Math.max(parsedMs + 2000, 5000);
        } else {
          delayMs = Math.pow(2, attempts) * 5000;
        }

        await ctx.runMutation(internal.researchJobs.updateJobStatus, {
          id: args.jobId,
          status: "failed",
          error: message,
        });
        await ctx.scheduler.runAfter(
          delayMs,
          internal.researchActions.startResearch,
          { jobId: args.jobId },
        );
      } else {
        await ctx.runMutation(internal.researchJobs.updateJobStatus, {
          id: args.jobId,
          status: "failed",
          error: `Failed after ${MAX_RETRIES} attempts: ${message}`,
        });
      }
    }
  },
});
