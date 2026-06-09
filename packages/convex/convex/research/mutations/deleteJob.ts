import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { logAuditEvent } from "../../auditLog";

/** Deletes a terminal job and its associated cost logs. */
export const deleteJob = mutation({
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
      job.status === "pending" ||
      job.status === "running" ||
      job.status === "formatting"
    ) {
      throw new Error(`Cannot delete a ${job.status} job. Cancel it first.`);
    }

    // Delete associated cost logs
    const costLogs = await ctx.db
      .query("costLogs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.id))
      .collect();

    // Deletes are independent per row; run them in parallel.
    await Promise.all(costLogs.map((log) => ctx.db.delete(log._id)));

    // Delete the job itself
    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      action: "job.delete",
      resourceType: "researchJobs",
      resourceId: args.id,
    });

    return args.id;
  },
});
