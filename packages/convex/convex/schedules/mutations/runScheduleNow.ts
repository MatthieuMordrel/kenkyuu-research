import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { mutation } from "../../_generated/server";
import { logAuditEvent } from "../../auditLog";
import { requireAuth } from "../../auth/shared/requireAuth";
import { vv } from "../../schema";

/** Trigger an immediate run of a schedule ("Run Now"). */
export const runScheduleNow = mutation({
  args: {
    id: vv.id("schedules"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const schedule = await ctx.db.get(args.id);
    if (!schedule) throw new Error("Schedule not found");

    await ctx.scheduler.runAfter(
      0,
      internal.schedules.actions.internalExecuteRunNow.internalExecuteRunNow,
      {
        scheduleId: args.id,
      }
    );

    await logAuditEvent(ctx, {
      action: "schedule.runNow",
      resourceType: "schedules",
      resourceId: args.id,
      details: schedule.name,
    });

    return args.id;
  },
});
