import type { ActionCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";

/** Resolve {{STOCKS}} / {{TICKER}} / {{DATE}} variables in the job's template. */
export async function resolvePrompt(
  ctx: ActionCtx,
  job: Doc<"researchJobs">
): Promise<string> {
  const stocks = await Promise.all(
    job.stockIds.map((id) =>
      ctx.runQuery(
        internal.research.queries.getStockInternal.getStockInternal,
        {
          id,
        }
      )
    )
  );
  const valid = stocks.filter((s): s is NonNullable<typeof s> => s !== null);
  const first = valid[0];

  return job.promptSnapshot
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
}
