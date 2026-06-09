import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { validateSearchTerm } from "../../validation";

/** Full-text search over research job metadata, newest matches first. */
export const searchResults = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    validateSearchTerm(args.searchTerm);
    const maxResults = Math.min(args.limit ?? 50, 100);
    const term = args.searchTerm.trim();

    if (term.length === 0) {
      return [];
    }

    const matches = await ctx.db
      .query("researchJobs")
      .withSearchIndex("search_metadata", (q) => q.search("searchText", term))
      .take(maxResults);

    return matches.toSorted((a, b) => b.createdAt - a.createdAt);
  },
});
