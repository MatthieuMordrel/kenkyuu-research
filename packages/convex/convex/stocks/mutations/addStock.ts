import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { validateStockInput } from "../../validation";
import { logAuditEvent } from "../../auditLog";

/** Add a new stock, rejecting duplicate tickers. */
export const addStock = mutation({
  args: {
    ticker: v.string(),
    exchange: v.string(),
    companyName: v.string(),
    sector: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    validateStockInput(args);

    // Duplicate validation: check if ticker already exists
    const existing = await ctx.db
      .query("stocks")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker))
      .unique();

    if (existing) {
      throw new Error(`Stock with ticker "${args.ticker}" already exists`);
    }

    const now = Date.now();
    const id = await ctx.db.insert("stocks", {
      ticker: args.ticker,
      exchange: args.exchange,
      companyName: args.companyName,
      sector: args.sector,
      notes: args.notes,
      tags: args.tags,
      createdAt: now,
      updatedAt: now,
    });
    await logAuditEvent(ctx, {
      action: "stock.create",
      resourceType: "stocks",
      resourceId: id,
      details: args.ticker,
    });
    return id;
  },
});
