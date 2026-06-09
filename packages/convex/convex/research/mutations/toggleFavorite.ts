import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Toggles the favorite flag on a research job. */
export const toggleFavorite = mutation({
  args: {
    id: vv.id("researchJobs"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    const newValue = !job.isFavorited;
    await ctx.db.patch(args.id, { isFavorited: newValue });
    return { id: args.id, isFavorited: newValue };
  },
});
