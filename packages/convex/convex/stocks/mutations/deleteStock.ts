import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { logAuditEvent } from "../../auditLog";

/** Delete a stock by id. */
export const deleteStock = mutation({
  args: { id: vv.id("stocks"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Stock not found");
    }

    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      action: "stock.delete",
      resourceType: "stocks",
      resourceId: args.id,
      details: existing.ticker,
    });
  },
});
