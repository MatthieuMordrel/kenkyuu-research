import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { RATE_LIMIT_WINDOW_MS } from "../shared/rateLimitWindowMs";

/** Records a login attempt and prunes attempts older than the rate limit window. */
export const internalRecordLoginAttempt = internalMutation({
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
        q.eq("identifier", args.identifier).lt("timestamp", windowStart)
      )
      .collect();

    // Deletes are independent per row; run them in parallel.
    await Promise.all(oldAttempts.map((attempt) => ctx.db.delete(attempt._id)));
  },
});
