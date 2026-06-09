import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { validateSearchTerm } from "../../validation";

/** List stocks with optional search, tag filter, and sorting. */
export const listStocks = query({
  args: {
    search: v.optional(v.string()),
    tag: v.optional(v.string()),
    sortBy: v.optional(
      v.union(
        v.literal("ticker"),
        v.literal("companyName"),
        v.literal("createdAt"),
        v.literal("updatedAt")
      )
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    if (args.search) validateSearchTerm(args.search);

    const maxResults = Math.min(args.limit ?? 500, 500);
    let stocks = await ctx.db.query("stocks").take(maxResults);

    // Filter by tag
    if (args.tag) {
      stocks = stocks.filter((s) => s.tags.includes(args.tag!));
    }

    // Filter by search (ticker or company name)
    if (args.search) {
      const term = args.search.toLowerCase();
      stocks = stocks.filter(
        (s) =>
          s.ticker.toLowerCase().includes(term) ||
          s.companyName.toLowerCase().includes(term)
      );
    }

    // Sort
    const sortBy = args.sortBy ?? "createdAt";
    const sortOrder = args.sortOrder ?? "desc";
    stocks.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    return stocks;
  },
});
