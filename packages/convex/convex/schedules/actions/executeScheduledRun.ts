"use node";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalAction } from "../../_generated/server";
import { logger } from "../../lib/logger";
import { vv } from "../../schema";

/**
 * Execute a scheduled research run and self-reschedule the next one.
 * This is the core self-rescheduling pattern: run -> schedule next -> repeat.
 */
export const executeScheduledRun = internalAction({
  args: {
    scheduleId: vv.id("schedules"),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.runQuery(
      internal.schedules.queries.getScheduleInternal.getScheduleInternal,
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
      internal.schedules.queries.getGlobalPauseStatusInternal
        .getGlobalPauseStatusInternal,
      {}
    );
    if (globalPaused) {
      return;
    }

    // Resolve stock IDs based on stock selection mode
    let stockIds: Id<"stocks">[] = [];

    if (schedule.stockSelection.type === "none") {
      stockIds = [];
    } else if (schedule.stockSelection.type === "specific") {
      stockIds = (schedule.stockSelection.stockIds ?? []) as Id<"stocks">[];
    } else {
      // For "all" and "tagged", fetch stocks
      const allStocks = await ctx.runQuery(
        internal.schedules.queries.listStocksInternal.listStocksInternal,
        {}
      );

      if (schedule.stockSelection.type === "all") {
        stockIds = allStocks.map((s) => s._id);
      } else if (
        schedule.stockSelection.type === "tagged" &&
        schedule.stockSelection.tags
      ) {
        const tagSet = new Set(schedule.stockSelection.tags);
        stockIds = allStocks
          .filter((s) => s.tags.some((t: string) => tagSet.has(t)))
          .map((s) => s._id);
      }
    }

    // Check prompt type: single-stock prompts create one job per stock
    const prompt = await ctx.runQuery(
      internal.prompts.queries.getPromptInternal.getPromptInternal,
      {
        id: schedule.promptId,
      }
    );
    const isSingleStock = prompt?.type === "single-stock";

    // Create and start the research job(s)
    try {
      if (isSingleStock && stockIds.length > 1) {
        // Queue one job per stock for single-stock prompts.
        // Jobs are independent; create them in parallel.
        await Promise.all(
          stockIds.map(async (stockId) => {
            try {
              await ctx.runMutation(
                internal.schedules.mutations.createScheduledJob
                  .createScheduledJob,
                {
                  promptId: schedule.promptId,
                  stockIds: [stockId],
                  provider: schedule.provider,
                  modelId: schedule.modelId,
                  scheduleId: args.scheduleId,
                }
              );
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : "Unknown error";
              logger.error(
                `Scheduled run failed for stock ${stockId}, schedule ${args.scheduleId}: ${message}`
              );
            }
          })
        );
      } else {
        await ctx.runMutation(
          internal.schedules.mutations.createScheduledJob.createScheduledJob,
          {
            promptId: schedule.promptId,
            stockIds,
            provider: schedule.provider,
            modelId: schedule.modelId,
            scheduleId: args.scheduleId,
          }
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        `Scheduled run failed for schedule ${args.scheduleId}: ${message}`
      );
    }

    // Update lastRunAt
    await ctx.runMutation(
      internal.schedules.mutations.updateScheduleNextRun.updateScheduleNextRun,
      {
        id: args.scheduleId,
        lastRunAt: Date.now(),
      }
    );

    // Self-reschedule: compute and schedule the next run
    await ctx.runAction(
      internal.schedules.actions.scheduleNextRun.scheduleNextRun,
      {
        scheduleId: args.scheduleId,
      }
    );
  },
});
