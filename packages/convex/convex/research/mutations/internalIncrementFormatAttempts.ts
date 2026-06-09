import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";

/** Increments the format-pass attempt counter and returns the new count. */
export const internalIncrementFormatAttempts = internalMutation({
  args: { id: vv.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, {
      formatAttempts: (job.formatAttempts ?? 0) + 1,
    });
    return (job.formatAttempts ?? 0) + 1;
  },
});
