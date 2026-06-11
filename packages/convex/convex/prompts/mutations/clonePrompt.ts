import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Clone an existing prompt as a non-built-in copy. */
export const clonePrompt = mutation({
  args: { id: vv.id("prompts"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Prompt not found");
    }

    const now = Date.now();
    return await ctx.db.insert("prompts", {
      name: `${existing.name} (Copy)`,
      description: existing.description,
      type: existing.type,
      template: existing.template,
      customFields: existing.customFields,
      defaultProvider: existing.defaultProvider,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});
