import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";

/** Resets format tracking for a backfill on an already-completed job. */
export const internalBeginBackfillFormat = internalMutation({
  args: { id: vv.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, {
      formatExternalId: undefined,
      formatStartedAt: Date.now(),
      formatAttempts: 0,
    });

    return args.id;
  },
});
