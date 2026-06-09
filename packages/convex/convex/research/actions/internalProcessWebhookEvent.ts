"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";

/** OpenAI webhook entry point — delegates to pollJob for the actual status check. */
export const internalProcessWebhookEvent = internalAction({
  args: {
    jobId: vv.id("researchJobs"),
    eventType: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Webhook delivery can fire after we've already processed the job (e.g.
    // via the recovery cron). pollJob's own idempotency guard handles that.
    await ctx.runAction(
      internal.research.actions.internalPollJob.internalPollJob,
      {
        jobId: args.jobId,
      }
    );
  },
});
