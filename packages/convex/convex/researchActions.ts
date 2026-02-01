"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const MAX_RETRIES = 3;

export const startResearch = internalAction({
  args: {
    jobId: v.id("researchJobs"),
  },
  handler: async (ctx, args) => {
    // Get the job details
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

    // Call OpenAI Deep Research API in background mode
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "failed",
        error: "OPENAI_API_KEY environment variable not set",
      });
      return;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "o3-deep-research",
          input: resolvedPrompt,
          background: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as { id: string };
      const externalJobId = data.id;

      // Store the external job ID for webhook matching
      await ctx.runMutation(internal.researchJobs.updateJobStatus, {
        id: args.jobId,
        status: "running",
        externalJobId,
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
        const delayMs = Math.pow(2, attempts) * 5000; // 5s, 10s, 20s
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
