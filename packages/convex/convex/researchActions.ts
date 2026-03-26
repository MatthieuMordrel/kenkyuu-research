"use node";

import { v } from "convex/values";
import OpenAI from "openai";
import { internalAction } from "./_generated/server";
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
          // If it's been extremely long (>3 hours), mark as failed to unblock the queue.
          const threeHours = 3 * 60 * 60 * 1000;
          if (Date.now() - job.createdAt > threeHours) {
            await ctx.runMutation(internal.researchJobs.updateJobStatus, {
              id: job._id,
              status: "failed",
              error: "Job timed out after 3 hours with no result from OpenAI",
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
    const stockTickers = stocks
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => s.ticker);

    // Build the final prompt with variable injection
    let resolvedPrompt = job.promptSnapshot;
    resolvedPrompt = resolvedPrompt.replaceAll(
      "{{STOCKS}}",
      stockTickers.join(", "),
    );
    resolvedPrompt = resolvedPrompt.replaceAll(
      "{{TICKER}}",
      stockTickers[0] ?? "",
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
        await ctx.runMutation(internal.researchJobs.updateJobStatus, {
          id: args.jobId,
          status: "failed",
          error: message,
        });
        // Schedule retry with exponential backoff
        const delayMs = Math.pow(2, attempts) * 5000;
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
