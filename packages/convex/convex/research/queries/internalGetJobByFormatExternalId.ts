import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/** Looks up a job by the OpenAI response id used for the formatting pass. */
export const internalGetJobByFormatExternalId = internalQuery({
  args: { formatExternalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("researchJobs")
      .withIndex("by_formatExternalId", (q) =>
        q.eq("formatExternalId", args.formatExternalId)
      )
      .unique();
  },
});
