import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { computeMonthlyCost } from "../shared/computeMonthlyCost";

/** Get total cost for the current calendar month. */
export const getMonthlyCost = query({
  args: {
    /** Optional: override the month to query (unix ms of any moment in the desired month). Defaults to now. */
    monthTimestamp: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await computeMonthlyCost(ctx, args.monthTimestamp);
  },
});
