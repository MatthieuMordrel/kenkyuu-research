import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { promptType } from "../shared/promptType";

/** List prompts, optionally filtered by type; built-ins first. */
export const listPrompts = query({
  args: {
    type: v.optional(promptType),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 200, 200);

    let prompts;
    if (args.type) {
      prompts = await ctx.db
        .query("prompts")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .take(maxResults);
    } else {
      prompts = await ctx.db.query("prompts").take(maxResults);
    }

    // Sort: built-in first, then by createdAt descending
    prompts.sort((a, b) => {
      if (a.isBuiltIn !== b.isBuiltIn) {
        return a.isBuiltIn ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    });

    return prompts;
  },
});
