import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";

/** Resolve all stock IDs from a schedule's stock selection */
export async function resolveSelectedStocks(
  ctx: ActionCtx,
  schedule: Doc<"schedules">
): Promise<Doc<"stocks">[]> {
  if (schedule.stockSelection.type === "all") {
    return await ctx.runQuery(
      internal.schedules.queries.internalListStocks.internalListStocks,
      {}
    );
  }
  if (schedule.stockSelection.type === "specific") {
    const ids = schedule.stockSelection.stockIds ?? [];
    if (ids.length === 0) return [];
    return await ctx.runQuery(
      internal.earnings.queries.internalGetStocksByIds.internalGetStocksByIds,
      {
        stockIds: ids,
      }
    );
  }
  if (schedule.stockSelection.type === "tagged") {
    const allStocks: Doc<"stocks">[] = await ctx.runQuery(
      internal.schedules.queries.internalListStocks.internalListStocks,
      {}
    );
    const tagSet = new Set(schedule.stockSelection.tags ?? []);
    return allStocks.filter((s) => s.tags.some((t: string) => tagSet.has(t)));
  }
  return [];
}
