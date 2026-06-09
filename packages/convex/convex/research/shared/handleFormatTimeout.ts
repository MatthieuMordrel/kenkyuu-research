import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { prepassResearchMarkdown } from "../../researchFormatPrepass";
import { completeFormatJob } from "./completeFormatJob";
import { sourceMarkdown } from "./sourceMarkdown";

/** Falls back to the prepass-only output when formatting timed out or failed. */
export async function handleFormatTimeout(
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
