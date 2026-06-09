"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id, Doc } from "../../_generated/dataModel";
import { mapSequentially } from "../../lib/asyncIterators";
import { logger } from "../../lib/logger";
import { addDays } from "../shared/addDays";
import { resolveEligibleStocks } from "../shared/resolveEligibleStocks";

/**
 * Test/dry-run action that simulates the earnings trigger for a given date.
 * Uses per-stock market timezones to compute today, but accepts an overrideDate
 * to simulate a specific day.
 */
export const internalTestCheckEarningsTriggers = internalAction({
  args: {
    overrideDate: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    simulatedDate?: string;
    dryRun?: boolean;
    schedulesChecked: number;
    matchesFound: Array<{
      scheduleName: string;
      offsetDays: number;
      targetEarningsDate: string;
      stockId: string;
      earningsDate: string;
      hour?: string;
      wouldSkipAmc: boolean;
      alreadyTriggered: boolean;
      action: string;
    }>;
  }> => {
    const isDryRun = args.dryRun ?? true;
    const simulatedToday = args.overrideDate;

    logger.info(
      `[TEST] Simulating earnings triggers for date=${simulatedToday}, dryRun=${isDryRun}`
    );

    const schedules: Doc<"schedules">[] = await ctx.runQuery(
      internal.earnings.queries.internalGetEarningsSchedules
        .internalGetEarningsSchedules,
      {}
    );

    if (schedules.length === 0) {
      logger.info("[TEST] No enabled earnings-type schedules found.");
      return { schedulesChecked: 0, matchesFound: [] };
    }

    logger.info(`[TEST] Found ${schedules.length} earnings schedule(s)`);

    const allMatches: Array<{
      scheduleName: string;
      offsetDays: number;
      targetEarningsDate: string;
      stockId: string;
      earningsDate: string;
      hour?: string;
      wouldSkipAmc: boolean;
      alreadyTriggered: boolean;
      action: string;
    }> = [];

    // Schedules are simulated one at a time so the [TEST] log output stays
    // grouped per schedule and readable in the dashboard.
    for await (const scheduleMatches of mapSequentially(
      schedules,
      async (schedule) => {
        const config = schedule.earningsConfig!;
        const targetEarningsDate = addDays(simulatedToday, -config.offsetDays);

        logger.info(
          `[TEST] Schedule "${schedule.name}": offset=${config.offsetDays}d, target earnings date=${targetEarningsDate}`
        );

        const earningsRecords = await ctx.runQuery(
          internal.earnings.queries.internalGetEarningsByDate
            .internalGetEarningsByDate,
          { date: targetEarningsDate }
        );

        if (earningsRecords.length === 0) {
          logger.info(`[TEST]   No earnings found for ${targetEarningsDate}`);
          return [];
        }

        logger.info(
          `[TEST]   Found ${earningsRecords.length} earnings record(s) on ${targetEarningsDate}`
        );

        const eligible = await resolveEligibleStocks(
          ctx,
          schedule,
          earningsRecords
        );

        // Eligible stocks are independent; evaluate (and trigger) in parallel.
        return await Promise.all(
          eligible.map(async ({ stockId, earningsId, earningsDate, hour }) => {
            const wouldSkipAmc =
              config.adjustForHour && config.offsetDays === 0 && hour === "amc";

            const alreadyTriggered = await ctx.runQuery(
              internal.earnings.queries.internalCheckAlreadyTriggered
                .internalCheckAlreadyTriggered,
              { scheduleId: schedule._id, earningsId }
            );

            let action: string;
            if (wouldSkipAmc) {
              action = "SKIP (amc adjustment)";
            } else if (alreadyTriggered) {
              action = "SKIP (already triggered)";
            } else if (isDryRun) {
              action = "WOULD TRIGGER (dry run)";
            } else {
              action = "TRIGGERING";
            }

            logger.info(
              `[TEST]   Stock ${stockId}: hour=${hour ?? "unknown"}, ${action}`
            );

            // Actually trigger if not dry run and not skipped
            if (!isDryRun && !wouldSkipAmc && !alreadyTriggered) {
              try {
                const jobId = await ctx.runMutation(
                  internal.schedules.mutations.internalCreateScheduledJob
                    .internalCreateScheduledJob,
                  {
                    promptId: schedule.promptId,
                    stockIds: [stockId],
                    provider: schedule.provider,
                    modelId: schedule.modelId,
                    scheduleId: schedule._id,
                  }
                );
                await ctx.runMutation(
                  internal.earnings.mutations.internalRecordTriggeredRun
                    .internalRecordTriggeredRun,
                  {
                    scheduleId: schedule._id,
                    earningsId,
                    stockId,
                    earningsDate,
                    jobId: jobId as Id<"researchJobs">,
                  }
                );
              } catch (error: unknown) {
                const message =
                  error instanceof Error ? error.message : "Unknown error";
                logger.error(`[TEST]   Error creating job: ${message}`);
              }
            }

            return {
              scheduleName: schedule.name,
              offsetDays: config.offsetDays,
              targetEarningsDate,
              stockId: stockId as string,
              earningsDate,
              hour,
              wouldSkipAmc,
              alreadyTriggered,
              action,
            };
          })
        );
      }
    )) {
      allMatches.push(...scheduleMatches);
    }

    logger.info(
      `[TEST] Summary: ${schedules.length} schedule(s) checked, ${allMatches.length} match(es) found`
    );

    return {
      simulatedDate: simulatedToday,
      dryRun: isDryRun,
      schedulesChecked: schedules.length,
      matchesFound: allMatches,
    };
  },
});
