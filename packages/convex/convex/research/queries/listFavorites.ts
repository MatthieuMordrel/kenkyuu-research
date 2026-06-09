import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Lists favorited research jobs, newest first. */
export const listFavorites = query({
  args: {
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 100, 200);
    return await ctx.db
      .query("researchJobs")
      .withIndex("by_isFavorited", (q) => q.eq("isFavorited", true))
      .order("desc")
      .take(maxResults);
  },
});
