import { internalQuery } from "../../_generated/server";
import { isMonthlyBudgetReached } from "../shared/isMonthlyBudgetReached";

/**
 * Internal budget gate for the research dispatch action.
 * Returns whether this month's spend has reached the configured threshold.
 */
export const checkBudgetReachedInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await isMonthlyBudgetReached(ctx);
  },
});
