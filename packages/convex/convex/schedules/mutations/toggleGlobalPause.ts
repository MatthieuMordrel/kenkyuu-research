import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { mutation } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Toggle the global schedules pause flag and (un)schedule cron-type schedules. */
export const toggleGlobalPause = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();

    const currentlyPaused = existing?.value === "true";
    const newValue = !currentlyPaused;

    if (existing) {
      await ctx.db.patch(existing._id, { value: String(newValue) });
    } else {
      await ctx.db.insert("settings", {
        key: "global_schedules_paused",
        value: String(newValue),
      });
    }

    if (newValue) {
      // Pausing: cancel all enabled cron-type scheduled functions
      const enabledSchedules = await ctx.db
        .query("schedules")
        .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true))
        .take(200);
      // Each schedule's cancel + patch is independent; run them in parallel.
      await Promise.all(
        enabledSchedules.map(async (schedule) => {
          if (!schedule.nextScheduledFunctionId) return;
          try {
            await ctx.scheduler.cancel(
              schedule.nextScheduledFunctionId as never
            );
          } catch {
            // Already executed or cancelled
          }
          await ctx.db.patch(schedule._id, {
            nextRunAt: undefined,
            nextScheduledFunctionId: undefined,
          });
        })
      );
      // Earnings-type schedules: hourly cron checks global pause status, no action needed
    } else {
      // Unpausing: reschedule all enabled cron-type schedules
      const enabledSchedules = await ctx.db
        .query("schedules")
        .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true))
        .take(200);
      // Rescheduling each cron-type schedule is independent; run in parallel.
      await Promise.all(
        enabledSchedules
          .filter((schedule) => (schedule.triggerType ?? "cron") === "cron")
          .map((schedule) =>
            ctx.scheduler.runAfter(
              0,
              internal.schedules.actions.scheduleNextRun.scheduleNextRun,
              {
                scheduleId: schedule._id,
              }
            )
          )
      );
    }

    return { paused: newValue };
  },
});
