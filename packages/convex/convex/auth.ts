"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

export const login = action({
  args: {
    password: v.string(),
    rememberMe: v.boolean(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ token: string; expiresAt: number }> => {
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
      throw new Error("Invalid password");
    }

    const result: { token: string; expiresAt: number } =
      await ctx.runMutation(internal.authHelpers.createSession, {
        rememberMe: args.rememberMe,
      });

    return result;
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
