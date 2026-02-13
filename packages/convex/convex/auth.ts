"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const LOGIN_IDENTIFIER = "global"; // Single-user app uses a global identifier

export const login = action({
  args: {
    password: v.string(),
    rememberMe: v.boolean(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ token: string; expiresAt: number }> => {
    // Check rate limit before attempting login
    const rateLimit = await ctx.runQuery(
      internal.authHelpers.checkLoginRateLimit,
      { identifier: LOGIN_IDENTIFIER },
    );

    if (!rateLimit.allowed) {
      const retryMinutes = Math.ceil(rateLimit.retryAfterMs / 60_000);
      throw new Error(
        `Too many login attempts. Try again in ${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}.`,
      );
    }

    const storedHash = (await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      {
        key: "auth_password_hash",
      },
    )) as string | null;

    if (!storedHash) {
      throw new Error("Authentication not configured");
    }

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(args.password, storedHash);

    if (!valid) {
      // Record failed attempt
      await ctx.runMutation(internal.authHelpers.recordLoginAttempt, {
        identifier: LOGIN_IDENTIFIER,
        success: false,
      });
      throw new Error("Invalid password");
    }

    // Record successful attempt (resets effective rate limit)
    await ctx.runMutation(internal.authHelpers.recordLoginAttempt, {
      identifier: LOGIN_IDENTIFIER,
      success: true,
    });

    const result: { token: string; expiresAt: number } =
      await ctx.runMutation(internal.authHelpers.createSession, {
        rememberMe: args.rememberMe,
      });

    return result;
  },
});

export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const storedHash = (await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      {
        key: "auth_password_hash",
      },
    )) as string | null;

    if (!storedHash) {
      throw new Error("Authentication not configured");
    }

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(args.currentPassword, storedHash);

    if (!valid) {
      throw new Error("Current password is incorrect");
    }

    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const newHash = await bcrypt.hash(args.newPassword, 10);

    await ctx.runMutation(internal.authHelpers.upsertSettingInternal, {
      key: "auth_password_hash",
      value: newHash,
    });
  },
});

export const logout = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runMutation(internal.authHelpers.deleteSession, {
      token: args.token,
    });
  },
});
