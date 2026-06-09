import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import {
  DEFAULT_FORMAT_MODEL_ID,
  resolveFormatModel,
} from "@repo/research-models/format-models";
import { dispatchPostCompleteSideEffects } from "./dispatchPostCompleteSideEffects";

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
export async function completeFormatJob(
  ctx: ActionCtx,
  args: FormatCompletionArgs
): Promise<void> {
  const formatModel = resolveFormatModel(DEFAULT_FORMAT_MODEL_ID);
  const researchCostUsd = args.job.costUsd ?? 0;

  if (!args.usedFallback && args.formattingCostUsd > 0) {
    await ctx.runMutation(
      internal.research.mutations.internalLogCost.internalLogCost,
      {
        jobId: args.job._id,
        provider: formatModel.providerId,
        modelId: formatModel.id,
        costUsd: args.formattingCostUsd,
      }
    );
  }

  if (args.mode === "pipeline") {
    await ctx.runMutation(
      internal.research.mutations.internalCompleteFormattedJob
        .internalCompleteFormattedJob,
      {
        id: args.job._id,
        result: args.resultText,
        costUsd: researchCostUsd + args.formattingCostUsd,
      }
    );
    await dispatchPostCompleteSideEffects(
      ctx,
      args.job._id,
      researchCostUsd + args.formattingCostUsd
    );
    return;
  }

  const source = args.job.rawResult ?? args.job.result ?? args.resultText;
  await ctx.runMutation(
    internal.research.mutations.internalApplyReformattedResult
      .internalApplyReformattedResult,
    {
      id: args.job._id,
      rawResult: source,
      result: args.resultText,
      additionalCostUsd: args.formattingCostUsd,
    }
  );
}
