import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { assertWithinBudget } from "../../costTracking/shared/assertWithinBudget";

/** Resets a failed job back to pending and schedules a fresh dispatch. */
export const retryJob = mutation({
  args: {
    id: vv.id("researchJobs"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    if (job.status !== "failed") {
      throw new Error("Can only retry failed jobs");
    }

    await assertWithinBudget(ctx);

    if (job.attempts >= 3) {
      // Reset attempts to allow manual retry
      await ctx.db.patch(args.id, { attempts: 0 });
    }

    // Reset status and schedule retry
    await ctx.db.patch(args.id, {
      status: "pending",
      error: undefined,
      completedAt: undefined,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.research.actions.internalStartResearch.internalStartResearch,
      {
        jobId: args.id,
      }
    );

    return args.id;
  },
});
