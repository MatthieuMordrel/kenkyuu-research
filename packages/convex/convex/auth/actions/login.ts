"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";

const LOGIN_IDENTIFIER = "global"; // Single-user app uses a global identifier

/** Authenticates with the global password and returns a new session token. */
export const login = action({
  args: {
    password: v.string(),
    rememberMe: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ token: string; expiresAt: number }> => {
    // Check rate limit before attempting login
    const rateLimit = await ctx.runQuery(
      internal.auth.queries.checkLoginRateLimit.checkLoginRateLimit,
      { identifier: LOGIN_IDENTIFIER }
    );

    if (!rateLimit.allowed) {
      const retryMinutes = Math.ceil(rateLimit.retryAfterMs / 60_000);
      throw new Error(
        `Too many login attempts. Try again in ${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}.`
      );
    }

    const storedHash = (await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      {
        key: "auth_password_hash",
      }
    )) as string | null;

    if (!storedHash) {
      throw new Error("Authentication not configured");
    }

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(args.password, storedHash);

    if (!valid) {
      // Record failed attempt
      await ctx.runMutation(
        internal.auth.mutations.recordLoginAttempt.recordLoginAttempt,
        {
          identifier: LOGIN_IDENTIFIER,
          success: false,
        }
      );
      throw new Error("Invalid password");
    }

    // Record successful attempt (resets effective rate limit)
    await ctx.runMutation(
      internal.auth.mutations.recordLoginAttempt.recordLoginAttempt,
      {
        identifier: LOGIN_IDENTIFIER,
        success: true,
      }
    );

    const result: { token: string; expiresAt: number } = await ctx.runMutation(
      internal.auth.mutations.createSession.createSession,
      {
        rememberMe: args.rememberMe,
      }
    );

    return result;
  },
});
