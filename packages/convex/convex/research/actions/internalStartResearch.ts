"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";
import { getHarnessAdapter, resolveJobModel } from "../../providers";
import { BUDGET_REACHED_MESSAGE } from "../../costTracking/shared/budgetReachedMessage";
import {
  countSubmittedJobs,
  DISPATCH_RETRY_DELAY_MS,
  hasDispatchSlot,
  openAiStartStaggerMs,
} from "../../researchConcurrency";
import { sleep } from "../shared/sleep";
import { MAX_RETRIES } from "../shared/maxRetries";
import { getProviderApiKey } from "../shared/getProviderApiKey";
import { missingKeyMessage } from "../shared/missingKeyMessage";
import { resolvePrompt } from "../shared/resolvePrompt";
import { handleStartError } from "../shared/handleStartError";

// Scheduled-poll cadence for providers without webhooks. Start aggressive,
// back off so long jobs don't burn scheduler invocations.
const POLL_INITIAL_DELAY_MS = 30_000;

/** Submits a pending research job to its provider. */
export const internalStartResearch = internalAction({
  args: { jobId: vv.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(
      internal.research.queries.internalGetJob.internalGetJob,
      { id: args.jobId }
    );
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
      internal.costTracking.queries.internalCheckBudgetReached
        .internalCheckBudgetReached,
      {}
    );
    if (budget.reached) {
      await ctx.runMutation(
        internal.research.mutations.internalUpdateJobStatus
          .internalUpdateJobStatus,
        {
          id: args.jobId,
          status: "failed",
          error: BUDGET_REACHED_MESSAGE,
        }
      );
      return;
    }

    const model = resolveJobModel(job);
    const activeJobs = await ctx.runQuery(
      internal.research.queries.internalGetConcurrencyJobs
        .internalGetConcurrencyJobs,
      {}
    );

    // Provider-aware dispatch gate: re-queue when this provider is at capacity.
    if (!hasDispatchSlot(activeJobs, model.providerId)) {
      await ctx.scheduler.runAfter(
        DISPATCH_RETRY_DELAY_MS,
        internal.research.actions.internalStartResearch.internalStartResearch,
        { jobId: args.jobId }
      );
      return;
    }

    const attempts = await ctx.runMutation(
      internal.research.mutations.internalIncrementAttempts
        .internalIncrementAttempts,
      { id: args.jobId }
    );
    if (attempts > MAX_RETRIES) {
      await ctx.runMutation(
        internal.research.mutations.internalUpdateJobStatus
          .internalUpdateJobStatus,
        {
          id: args.jobId,
          status: "failed",
          error: `Exceeded maximum retries (${MAX_RETRIES})`,
        }
      );
      return;
    }

    await ctx.runMutation(
      internal.research.mutations.internalUpdateJobStatus
        .internalUpdateJobStatus,
      {
        id: args.jobId,
        status: "running",
      }
    );

    if (model.providerId === "openai") {
      const submittedOpenAiCount = countSubmittedJobs(activeJobs, "openai");
      const staggerMs = openAiStartStaggerMs(submittedOpenAiCount);
      if (staggerMs > 0) {
        await sleep(staggerMs);
      }
    }

    const adapter = getHarnessAdapter(model);
    const apiKey = await getProviderApiKey(ctx, model.providerId);
    if (!apiKey) {
      await ctx.runMutation(
        internal.research.mutations.internalUpdateJobStatus
          .internalUpdateJobStatus,
        {
          id: args.jobId,
          status: "failed",
          error: missingKeyMessage(model.providerId),
        }
      );
      return;
    }

    const resolvedPrompt = await resolvePrompt(ctx, job, model);

    try {
      const { externalId, submittedPrompt } = await adapter.start(
        model,
        resolvedPrompt,
        apiKey
      );

      await ctx.runMutation(
        internal.research.mutations.internalUpdateJobStatus
          .internalUpdateJobStatus,
        {
          id: args.jobId,
          status: "running",
          externalJobId: externalId,
          resolvedPrompt: submittedPrompt ?? resolvedPrompt,
        }
      );

      // Models without webhooks need us to poll until they finish.
      if (model.completionMode === "polling") {
        await ctx.scheduler.runAfter(
          POLL_INITIAL_DELAY_MS,
          internal.research.actions.internalPollJob.internalPollJob,
          { jobId: args.jobId, nextDelayMs: POLL_INITIAL_DELAY_MS }
        );
      }
    } catch (error) {
      await handleStartError(ctx, args.jobId, attempts, error);
    }
  },
});
