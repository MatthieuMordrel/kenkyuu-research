import type { QueryCtx, MutationCtx } from "../../_generated/server";

/**
 * Reads the configured monthly budget threshold (USD).
 * Returns null when unset, non-numeric, or non-positive (i.e. enforcement off).
 */
export async function getBudgetThreshold(
  ctx: QueryCtx | MutationCtx
): Promise<number | null> {
  const setting = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "budget_threshold"))
    .unique();
  if (!setting) return null;
  const threshold = parseFloat(setting.value);
  return Number.isFinite(threshold) && threshold > 0 ? threshold : null;
}
