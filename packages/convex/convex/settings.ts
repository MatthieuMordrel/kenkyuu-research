import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

const PROTECTED_SETTING_KEYS = new Set([
  "auth_password_hash",
]);

async function validateSession(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<void> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Unauthorized");
  }
}

export const getSetting = query({
  args: { key: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    await validateSession(ctx, args.token);

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return setting?.value ?? null;
  },
});

export const upsertSetting = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.token) throw new Error("Unauthorized");
    await validateSession(ctx, args.token);

    if (PROTECTED_SETTING_KEYS.has(args.key)) {
      throw new Error(`Setting "${args.key}" cannot be modified directly`);
    }

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
      return existing._id;
    }

    return await ctx.db.insert("settings", {
      key: args.key,
      value: args.value,
    });
  },
});
