"use node";

import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { vv } from "../../schema";
import { computeNextRunAt } from "../shared/computeNextRunAt";

/**
 * Compute and schedule the next run for a given schedule.
 * Called when a schedule is created, enabled, or after a run completes.
 */
export const internalScheduleNextRun = internalAction({
  args: {
    scheduleId: vv.id("schedules"),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.runQuery(
      internal.schedules.queries.internalGetSchedule.internalGetSchedule,
      {
        id: args.scheduleId,
      }
    );

    if (!schedule || !schedule.enabled) {
      return;
    }

    // Earnings-type schedules are driven by the hourly cron, not self-rescheduling
    if (schedule.triggerType === "earnings") {
      return;
    }

    // Check global pause
    const globalPaused = await ctx.runQuery(
      internal.schedules.queries.internalGetGlobalPauseStatus
        .internalGetGlobalPauseStatus,
      {}
    );
    if (globalPaused) {
      return;
    }

    // Compute next run time
    const now = Date.now();
    if (!schedule.cron) {
      return;
    }
    const nextRunAt = computeNextRunAt(
      schedule.cron,
      schedule.timezone ?? "UTC",
      now
    );

    // Schedule the execution action at that time
    const delayMs = Math.max(0, nextRunAt - now);
    const scheduledId = await ctx.scheduler.runAfter(
      delayMs,
      internal.schedules.actions.internalExecuteScheduledRun
        .internalExecuteScheduledRun,
      { scheduleId: args.scheduleId }
    );

    // Update the schedule with nextRunAt and the scheduled function ID.
    // Id<"_scheduled_functions"> is a branded string, assignable to string.
    await ctx.runMutation(
      internal.schedules.mutations.internalUpdateScheduleNextRun
        .internalUpdateScheduleNextRun,
      {
        id: args.scheduleId,
        nextRunAt,
        nextScheduledFunctionId: scheduledId,
      }
    );
  },
});
