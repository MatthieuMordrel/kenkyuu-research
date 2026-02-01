import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// --- Mutations ---

export const addStock = mutation({
  args: {
    ticker: v.string(),
    exchange: v.string(),
    companyName: v.string(),
    sector: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Duplicate validation: check if ticker already exists
    const existing = await ctx.db
      .query("stocks")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker))
      .unique();

    if (existing) {
      throw new Error(`Stock with ticker "${args.ticker}" already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("stocks", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStock = mutation({
  args: {
    id: v.id("stocks"),
    ticker: v.optional(v.string()),
    exchange: v.optional(v.string()),
    companyName: v.optional(v.string()),
    sector: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Stock not found");
    }

    // If ticker is being changed, check for duplicates
    if (updates.ticker && updates.ticker !== existing.ticker) {
      const duplicate = await ctx.db
        .query("stocks")
        .withIndex("by_ticker", (q) => q.eq("ticker", updates.ticker!))
        .unique();

      if (duplicate) {
        throw new Error(
          `Stock with ticker "${updates.ticker}" already exists`,
        );
      }
    }

    // Build patch object with only provided fields
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.ticker !== undefined) patch.ticker = updates.ticker;
    if (updates.exchange !== undefined) patch.exchange = updates.exchange;
    if (updates.companyName !== undefined)
      patch.companyName = updates.companyName;
    if (updates.sector !== undefined) patch.sector = updates.sector;
    if (updates.notes !== undefined) patch.notes = updates.notes;
    if (updates.tags !== undefined) patch.tags = updates.tags;

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const deleteStock = mutation({
  args: { id: v.id("stocks") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Stock not found");
    }

    await ctx.db.delete(args.id);
  },
});

// --- Queries ---

export const listStocks = query({
  args: {
    search: v.optional(v.string()),
    tag: v.optional(v.string()),
    sortBy: v.optional(
      v.union(
        v.literal("ticker"),
        v.literal("companyName"),
        v.literal("createdAt"),
        v.literal("updatedAt"),
      ),
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    let stocks = await ctx.db.query("stocks").collect();

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
          s.companyName.toLowerCase().includes(term),
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

export const getStock = query({
  args: { id: v.id("stocks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getStockByTicker = query({
  args: { ticker: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stocks")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker))
      .unique();
  },
});

export const listTags = query({
  args: {},
  handler: async (ctx) => {
    const stocks = await ctx.db.query("stocks").collect();
    const tagSet = new Set<string>();
    for (const stock of stocks) {
      for (const tag of stock.tags) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].toSorted();
  },
});
