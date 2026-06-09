import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id, Doc } from "../../_generated/dataModel";

/** Resolve stock IDs from a schedule's stock selection intersected with a set of earnings records. */
export async function resolveEligibleStocks(
  ctx: ActionCtx,
  schedule: Doc<"schedules">,
  earningsRecords: Doc<"earnings">[]
): Promise<
  Array<{
    stockId: Id<"stocks">;
    earningsId: Id<"earnings">;
    earningsDate: string;
    hour?: string;
  }>
> {
  const earningsStockIds = new Set(
    earningsRecords.map((e) => e.stockId as string)
  );

  let eligibleStockIds: Set<string>;

  if (schedule.stockSelection.type === "all") {
    eligibleStockIds = earningsStockIds;
  } else if (schedule.stockSelection.type === "specific") {
    const specifiedIds = new Set(
      (schedule.stockSelection.stockIds ?? []).map((id) => id as string)
    );
    eligibleStockIds = new Set(
      [...earningsStockIds].filter((id) => specifiedIds.has(id))
    );
  } else if (schedule.stockSelection.type === "tagged") {
    const allStocks = await ctx.runQuery(
      internal.schedules.queries.listStocksInternal.listStocksInternal,
      {}
    );
    const tagSet = new Set(schedule.stockSelection.tags ?? []);
    const taggedStockIds = new Set(
      (allStocks as Doc<"stocks">[])
        .filter((s: Doc<"stocks">) => s.tags.some((t: string) => tagSet.has(t)))
        .map((s: Doc<"stocks">) => s._id as string)
    );
    eligibleStockIds = new Set(
      [...earningsStockIds].filter((id) => taggedStockIds.has(id))
    );
  } else {
    return [];
  }

  return earningsRecords
    .filter((e) => eligibleStockIds.has(e.stockId as string))
    .map((e) => ({
      stockId: e.stockId,
      earningsId: e._id,
      earningsDate: e.date,
      hour: e.hour,
    }));
}
