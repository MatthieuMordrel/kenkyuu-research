import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { PROTECTED_SETTING_KEYS } from "../shared/protectedSettingKeys";

/** Get a setting value by key; protected secrets are never readable. */
export const getSetting = query({
  args: { key: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    // Never expose protected secrets (e.g. the password hash) over a readable
    // query, even to an authenticated client — these are write-only from the UI.
    if (PROTECTED_SETTING_KEYS.has(args.key)) {
      throw new Error(`Setting "${args.key}" cannot be read`);
    }

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return setting?.value ?? null;
  },
});
