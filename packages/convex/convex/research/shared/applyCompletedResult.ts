"use node";

import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { estimateModelCost, type PollResult } from "../../providers";
import type { ResearchModelDefinition } from "@repo/research-models/types";

/**
 * Terminal bookkeeping for a completed provider result — shared between the
 * webhook path and the polling path. Persists the raw result, logs cost, and
 * kicks off the formatting phase.
 */
export async function applyCompletedResult(
  ctx: ActionCtx,
  job: Doc<"researchJobs">,
  model: ResearchModelDefinition,
  result: Extract<PollResult, { status: "completed" }>
) {
  const costUsd = estimateModelCost(model, result.usage);
  const durationMs = Date.now() - job.createdAt;
  const toolCallCount =
    result.usage.toolCalls ?? result.usage.webSearchRequests;

  await ctx.runMutation(
    internal.research.mutations.internalBeginFormattingPhase
      .internalBeginFormattingPhase,
    {
      id: job._id,
      rawResult: result.text,
      costUsd,
      durationMs,
      toolCallCount,
    }
  );

  await ctx.runMutation(
    internal.research.mutations.internalLogCost.internalLogCost,
    {
      jobId: job._id,
      provider: model.providerId,
      modelId: model.id,
      costUsd,
    }
  );

  await ctx.scheduler.runAfter(
    0,
    internal.research.actions.internalStartFormat.internalStartFormat,
    {
      jobId: job._id,
      mode: "pipeline",
    }
  );
}
