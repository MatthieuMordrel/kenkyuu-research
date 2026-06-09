import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** List all distinct tags across stocks, sorted alphabetically. */
export const listTags = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const stocks = await ctx.db.query("stocks").take(500);
    const tagSet = new Set<string>();
    for (const stock of stocks) {
      for (const tag of stock.tags) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].toSorted();
  },
});
