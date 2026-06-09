"use node";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalAction } from "../../_generated/server";
import { logger } from "../../lib/logger";
import { vv } from "../../schema";

/**
 * Execute a schedule immediately on demand ("Run Now").
 * Does not check enabled/global-pause, does not self-reschedule.
 */
export const executeRunNow = internalAction({
  args: {
    scheduleId: vv.id("schedules"),
  },
  handler: async (ctx, args): Promise<void> => {
    const schedule = await ctx.runQuery(
      internal.schedules.queries.getScheduleInternal.getScheduleInternal,
      {
        id: args.scheduleId,
      }
    );
    if (!schedule) return;

    // Resolve stock IDs based on stock selection mode
    let stockIds: Id<"stocks">[] = [];

    if (schedule.stockSelection.type === "none") {
      stockIds = [];
    } else if (schedule.stockSelection.type === "specific") {
      stockIds = (schedule.stockSelection.stockIds ?? []) as Id<"stocks">[];
    } else {
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
                `Run Now failed for stock ${stockId}, schedule ${args.scheduleId}: ${message}`
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
        `Run Now failed for schedule ${args.scheduleId}: ${message}`
      );
    }

    await ctx.runMutation(
      internal.schedules.mutations.updateScheduleNextRun.updateScheduleNextRun,
      {
        id: args.scheduleId,
        lastRunAt: Date.now(),
      }
    );
  },
});
