import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const getSettingValue = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return setting?.value ?? null;
  },
});

export const createSession = internalMutation({
  args: { rememberMe: v.boolean() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const duration = args.rememberMe
      ? REMEMBER_ME_DURATION_MS
      : SESSION_DURATION_MS;
    const token = generateToken();

    await ctx.db.insert("sessions", {
      token,
      expiresAt: now + duration,
      rememberMe: args.rememberMe,
      createdAt: now,
    });

    return { token, expiresAt: now + duration };
  },
});

export const deleteSession = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

export const upsertSettingInternal = internalMutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: args.value });
    }
  },
});

export const validateSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!session) {
      return { valid: false } as const;
    }

    if (session.expiresAt < Date.now()) {
      return { valid: false } as const;
    }

    return { valid: true, expiresAt: session.expiresAt } as const;
  },
});

export const validateSessionInternal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) {
      return { valid: false } as const;
    }

    return { valid: true } as const;
  },
});
