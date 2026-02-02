import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function validateSession(
  ctx: { db: any },
  token: string,
): Promise<void> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Unauthorized");
  }
}

export const getSetting = query({
  args: { key: v.string(), token: v.string() },
  handler: async (ctx, args) => {
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
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await validateSession(ctx, args.token);

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
