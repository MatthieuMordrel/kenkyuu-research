import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { generateToken } from "../shared/generateToken";
import {
  REMEMBER_ME_DURATION_MS,
  SESSION_DURATION_MS,
} from "../shared/sessionDurations";

const SESSION_ROTATION_THRESHOLD_MS = 1 * 60 * 60 * 1000; // Rotate after 1 hour

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
