import { internalQuery } from "../../_generated/server";
import { vv } from "../../schema";

/** Returns a research job by id for internal callers. */
export const internalGetJob = internalQuery({
  args: { id: vv.id("researchJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
