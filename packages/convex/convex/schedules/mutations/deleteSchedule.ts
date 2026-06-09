import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { logAuditEvent } from "../../auditLog";
import { requireAuth } from "../../auth/shared/requireAuth";
import { vv } from "../../schema";

/** Delete a schedule and cancel its pending scheduled function. */
export const deleteSchedule = mutation({
  args: {
    id: vv.id("schedules"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    // Cancel any pending scheduled function
    if (schedule.nextScheduledFunctionId) {
      try {
        await ctx.scheduler.cancel(schedule.nextScheduledFunctionId as never);
      } catch {
        // May already have executed or been cancelled
      }
    }

    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      action: "schedule.delete",
      resourceType: "schedules",
      resourceId: args.id,
      details: schedule.name,
    });
    return args.id;
  },
});
