import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

/** Deletes the session matching the given token, if it exists. */
export const internalDeleteSession = internalMutation({
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
