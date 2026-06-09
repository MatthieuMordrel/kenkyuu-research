import { internalQuery } from "../../_generated/server";
import { vv } from "../../schema";

/** Get a single prompt by id (internal, no auth). */
export const getPromptInternal = internalQuery({
  args: { id: vv.id("prompts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
