import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { mutation } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { vv } from "../../schema";

/** Toggle a schedule's enabled state and reconcile its scheduled function. */
export const toggleSchedule = mutation({
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

    const newEnabled = !schedule.enabled;
    await ctx.db.patch(args.id, { enabled: newEnabled });

    // Check global pause
    const globalPause = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();
    const isGloballyPaused = globalPause?.value === "true";

    const isCronType = (schedule.triggerType ?? "cron") === "cron";

    if (isCronType) {
      if (newEnabled && !isGloballyPaused) {
        await ctx.scheduler.runAfter(
          0,
          internal.schedules.actions.scheduleNextRun.scheduleNextRun,
          {
            scheduleId: args.id,
          }
        );
      } else if (!newEnabled) {
        if (schedule.nextScheduledFunctionId) {
          try {
            await ctx.scheduler.cancel(
              schedule.nextScheduledFunctionId as never
            );
          } catch {
            // May already have executed or been cancelled
          }
        }
        await ctx.db.patch(args.id, {
          nextRunAt: undefined,
          nextScheduledFunctionId: undefined,
        });
      }
    }
    // Earnings-type schedules: just toggling enabled is enough; the hourly cron checks enabled status

    return { id: args.id, enabled: newEnabled };
  },
});
