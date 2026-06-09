import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";

/** Stores the OpenAI response id after submitting the format pass. */
export const setFormatExternalId = internalMutation({
  args: {
    id: vv.id("researchJobs"),
    formatExternalId: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, { formatExternalId: args.formatExternalId });
    return args.id;
  },
});
