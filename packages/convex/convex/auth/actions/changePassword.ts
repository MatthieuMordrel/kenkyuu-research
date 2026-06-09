"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";

/** Changes the global password after verifying the session and current password. */
export const changePassword = action({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Require an authenticated session. Without this, the action is a public
    // password-guessing oracle that bypasses the login rate limiter.
    const session = await ctx.runQuery(
      internal.auth.queries.validateSessionInternal.validateSessionInternal,
      { token: args.token }
    );
    if (!session.valid) {
      throw new Error("Unauthorized");
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
    const valid = await bcrypt.compare(args.currentPassword, storedHash);

    if (!valid) {
      throw new Error("Current password is incorrect");
    }

    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    const newHash = await bcrypt.hash(args.newPassword, 10);

    await ctx.runMutation(
      internal.auth.mutations.upsertSettingInternal.upsertSettingInternal,
      {
        key: "auth_password_hash",
        value: newHash,
      }
    );
  },
});
