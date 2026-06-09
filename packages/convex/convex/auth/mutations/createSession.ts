import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { generateToken } from "../shared/generateToken";
import {
  REMEMBER_ME_DURATION_MS,
  SESSION_DURATION_MS,
} from "../shared/sessionDurations";

/** Creates a new session and returns its token and expiry. */
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
