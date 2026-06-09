"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";

/** Logs out by deleting the session matching the given token. */
export const logout = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runMutation(internal.auth.mutations.deleteSession.deleteSession, {
      token: args.token,
    });
  },
});
