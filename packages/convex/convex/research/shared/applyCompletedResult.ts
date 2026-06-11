"use node";

import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { estimateModelCost, type PollResult } from "../../providers";
import type { ResearchModelDefinition } from "@repo/research-models/types";
import {
  extractCustomFieldValues,
  type CustomFieldValue,
} from "@repo/research-models/custom-fields";

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

  // Pull the agent's structured-field block out of the report before formatting,
  // so the machine-readable block never reaches the formatter or the raw view.
  let rawResult = result.text;
  let customFieldValues: CustomFieldValue[] | undefined;
  if (job.customFields && job.customFields.length > 0) {
    const extracted = extractCustomFieldValues(result.text, job.customFields);
    rawResult = extracted.markdown;
    customFieldValues = extracted.values;
  }

  await ctx.runMutation(
    internal.research.mutations.internalBeginFormattingPhase
      .internalBeginFormattingPhase,
    {
      id: job._id,
      rawResult,
      customFieldValues,
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
