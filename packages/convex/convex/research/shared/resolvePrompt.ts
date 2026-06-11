import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { buildCustomFieldsPromptSection } from "@repo/research-models/custom-fields";

/** Resolve {{STOCKS}} / {{TICKER}} / {{DATE}} variables in the job's template. */
export async function resolvePrompt(
  ctx: ActionCtx,
  job: Doc<"researchJobs">
): Promise<string> {
  const stocks = await Promise.all(
    job.stockIds.map((id) =>
      ctx.runQuery(
        internal.research.queries.internalGetStock.internalGetStock,
        {
          id,
        }
      )
    )
  );
  const valid = stocks.filter((s): s is NonNullable<typeof s> => s !== null);
  const first = valid[0];

  const resolved = job.promptSnapshot
    .replaceAll(
      "{{STOCKS}}",
      valid
        .map((s) => `${s.ticker} (${s.companyName}, ${s.exchange})`)
        .join(", ")
    )
    .replaceAll(
      "{{TICKER}}",
      first ? `${first.ticker} (${first.companyName}, ${first.exchange})` : ""
    )
    .replaceAll("{{DATE}}", new Date().toISOString().split("T")[0]!);

  // Append the structured-output contract when the prompt declares custom fields.
  return resolved + buildCustomFieldsPromptSection(job.customFields ?? []);
}
