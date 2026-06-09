import type { QueryCtx, MutationCtx } from "../../_generated/server";
import { BUDGET_REACHED_MESSAGE } from "./budgetReachedMessage";
import { isMonthlyBudgetReached } from "./isMonthlyBudgetReached";

/** Throws {@link BUDGET_REACHED_MESSAGE} when the monthly budget is reached. */
export async function assertWithinBudget(
  ctx: QueryCtx | MutationCtx
): Promise<void> {
  const { reached } = await isMonthlyBudgetReached(ctx);
  if (reached) {
    throw new Error(BUDGET_REACHED_MESSAGE);
  }
}
