import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import type { ResearchModelDefinition } from "@repo/research-models/types";
import {
  buildCustomFieldsPromptSection,
  type CustomFieldsDelivery,
} from "@repo/research-models/custom-fields";
import { MANAGED_AGENT_REPORT_PATH } from "@repo/research-models/managed-agent-prompt";

/** Resolve {{STOCKS}} / {{TICKER}} / {{DATE}} variables in the job's template. */
export async function resolvePrompt(
  ctx: ActionCtx,
  job: Doc<"researchJobs">,
  model: ResearchModelDefinition
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
  // The Managed Agents harness delivers a report file (its messages are only
  // status notes), so the block must be written into that file; chat harnesses
  // emit it in the reply. extractCustomFieldValues reads whichever text the
  // harness ultimately collects, so the delivery target must match the harness.
  const delivery: CustomFieldsDelivery =
    model.harnessId === "anthropic-managed-agents"
      ? { location: "file", filePath: MANAGED_AGENT_REPORT_PATH }
      : { location: "message" };

  return (
    resolved + buildCustomFieldsPromptSection(job.customFields ?? [], delivery)
  );
}
