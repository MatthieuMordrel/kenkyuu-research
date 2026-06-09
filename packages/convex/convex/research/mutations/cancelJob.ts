import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { logAuditEvent } from "../../auditLog";
import { scheduleProviderQueueDrain } from "../shared/scheduleProviderQueueDrain";

/** Cancels a pending/running/formatting job, marking it failed and freeing its provider slot. */
export const cancelJob = mutation({
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

    if (
      job.status !== "pending" &&
      job.status !== "running" &&
      job.status !== "formatting"
    ) {
      throw new Error(`Cannot cancel job with status "${job.status}"`);
    }

    await ctx.db.patch(args.id, {
      status: "failed",
      error: "Cancelled by user",
      completedAt: Date.now(),
      externalJobId: undefined,
      formatExternalId: undefined,
      formatStartedAt: undefined,
      formatAttempts: undefined,
    });
    await scheduleProviderQueueDrain(ctx, job.provider);
    await logAuditEvent(ctx, {
      action: "job.cancel",
      resourceType: "researchJobs",
      resourceId: args.id,
    });

    return args.id;
  },
});
