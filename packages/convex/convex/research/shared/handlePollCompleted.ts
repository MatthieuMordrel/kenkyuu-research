import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import {
  DEFAULT_FORMAT_MODEL_ID,
  estimateFormatCost,
  resolveFormatModel,
} from "@repo/research-models/format-models";
import type { PollResult } from "../../providers/types";
import { evaluateFormattedOutput } from "../../researchFormatCore";
import { prepassResearchMarkdown } from "../../researchFormatPrepass";
import { completeFormatJob } from "./completeFormatJob";
import { scheduleStart } from "./scheduleStart";
import { sourceMarkdown } from "./sourceMarkdown";

/** Applies a completed format poll result: accept, retry, or fall back. */
export async function handlePollCompleted(
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
    await ctx.runMutation(
      internal.research.mutations.incrementFormatAttempts
        .incrementFormatAttempts,
      { id: job._id }
    );
    await ctx.runMutation(
      internal.research.mutations.clearFormatExternalId.clearFormatExternalId,
      { id: job._id }
    );
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
