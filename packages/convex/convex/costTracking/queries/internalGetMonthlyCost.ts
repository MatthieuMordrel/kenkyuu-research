import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { computeMonthlyCost } from "../shared/computeMonthlyCost";

/** Internal version of getMonthlyCost for use by actions (e.g., budget alerts). */
export const internalGetMonthlyCost = internalQuery({
  args: {
    monthTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await computeMonthlyCost(ctx, args.monthTimestamp);
  },
});
