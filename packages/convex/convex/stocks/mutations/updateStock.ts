import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { validateStockInput } from "../../validation";
import { logAuditEvent } from "../../auditLog";

/** Update an existing stock, guarding against duplicate tickers. */
export const updateStock = mutation({
  args: {
    id: vv.id("stocks"),
    ticker: v.optional(v.string()),
    exchange: v.optional(v.string()),
    companyName: v.optional(v.string()),
    sector: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    validateStockInput(args);

    const { id, token: _token, ...updates } = args;

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
        throw new Error(`Stock with ticker "${updates.ticker}" already exists`);
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
    await logAuditEvent(ctx, {
      action: "stock.update",
      resourceType: "stocks",
      resourceId: id,
    });
    return id;
  },
});
