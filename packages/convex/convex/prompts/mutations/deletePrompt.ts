import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { logAuditEvent } from "../../auditLog";

/** Delete a prompt; built-in prompts cannot be deleted. */
export const deletePrompt = mutation({
  args: { id: vv.id("prompts"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Prompt not found");
    }

    if (existing.isBuiltIn) {
      throw new Error("Cannot delete built-in prompts");
    }

    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      action: "prompt.delete",
      resourceType: "prompts",
      resourceId: args.id,
      details: existing.name,
    });
  },
});
