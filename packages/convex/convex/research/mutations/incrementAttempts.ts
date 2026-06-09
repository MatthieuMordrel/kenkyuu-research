import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";

/** Increments the research attempt counter and returns the new count. */
export const incrementAttempts = internalMutation({
  args: {
    id: vv.id("researchJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, { attempts: job.attempts + 1 });
    return job.attempts + 1;
  },
});
