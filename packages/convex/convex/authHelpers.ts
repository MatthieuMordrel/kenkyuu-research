import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_ROTATION_THRESHOLD_MS = 1 * 60 * 60 * 1000; // Rotate after 1 hour

/**
 * Validates that a session token is present and valid.
 * Throws "Unauthorized" if the token is missing, invalid, or expired.
 * Use in all public queries and mutations to enforce authentication.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined,
): Promise<void> {
  if (!token) {
    throw new Error("Unauthorized");
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Unauthorized");
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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

/**
 * Rotates the session token if it's older than the rotation threshold.
 * Returns a new token if rotated, null otherwise.
 */
export const refreshSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!session || session.expiresAt < Date.now()) {
      return null;
    }

    // Only rotate if the session is older than the threshold
    const sessionAge = Date.now() - session.createdAt;
    if (sessionAge < SESSION_ROTATION_THRESHOLD_MS) {
      return null;
    }

    // Generate new token and update the session
    const newToken = generateToken();
    const duration = session.rememberMe
      ? REMEMBER_ME_DURATION_MS
      : SESSION_DURATION_MS;
    const newExpiresAt = Date.now() + duration;

    // Delete old session
    await ctx.db.delete(session._id);

    // Create new session
    await ctx.db.insert("sessions", {
      token: newToken,
      expiresAt: newExpiresAt,
      rememberMe: session.rememberMe,
      createdAt: Date.now(),
    });

    return { token: newToken, expiresAt: newExpiresAt };
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

// --- Rate Limiting ---

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const checkLoginRateLimit = internalQuery({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;

    const recentAttempts = await ctx.db
      .query("loginAttempts")
      .withIndex("by_identifier_timestamp", (q) =>
        q.eq("identifier", args.identifier).gte("timestamp", windowStart),
      )
      .collect();

    const failedAttempts = recentAttempts.filter((a) => !a.success);
    return {
      allowed: failedAttempts.length < MAX_LOGIN_ATTEMPTS,
      remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - failedAttempts.length),
      retryAfterMs: failedAttempts.length >= MAX_LOGIN_ATTEMPTS
        ? RATE_LIMIT_WINDOW_MS - (Date.now() - Math.min(...failedAttempts.map((a) => a.timestamp)))
        : 0,
    };
  },
});

export const recordLoginAttempt = internalMutation({
  args: {
    identifier: v.string(),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("loginAttempts", {
      identifier: args.identifier,
      timestamp: Date.now(),
      success: args.success,
    });

    // Cleanup: delete attempts older than the window to prevent table bloat
    const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
    const oldAttempts = await ctx.db
      .query("loginAttempts")
      .withIndex("by_identifier_timestamp", (q) =>
        q.eq("identifier", args.identifier).lt("timestamp", windowStart),
      )
      .collect();

    for (const attempt of oldAttempts) {
      await ctx.db.delete(attempt._id);
    }
  },
});
