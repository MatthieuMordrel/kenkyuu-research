import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/** Reads a setting value by key, returning null when unset. */
export const internalGetSettingValue = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return setting?.value ?? null;
  },
});
