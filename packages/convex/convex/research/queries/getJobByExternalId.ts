import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/** Looks up a job by the provider's external research job id. */
export const getJobByExternalId = internalQuery({
  args: { externalJobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("researchJobs")
      .withIndex("by_externalJobId", (q) =>
        q.eq("externalJobId", args.externalJobId)
      )
      .unique();
  },
});
