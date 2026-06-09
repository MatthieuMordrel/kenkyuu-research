import { v } from "convex/values";
import { query } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Get a single prompt by id. */
export const getPrompt = query({
  args: { id: vv.id("prompts"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.get(args.id);
  },
});
