import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

/** Mark that a budget alert has been sent for a given month. */
export const markBudgetAlertSent = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: "true" });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: "true" });
    }
  },
});
