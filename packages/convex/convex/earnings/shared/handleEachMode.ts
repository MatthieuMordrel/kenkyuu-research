import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id, Doc } from "../../_generated/dataModel";
import { getMarketTimezone } from "../../lib/exchangeTimezones";
import { logger } from "../../lib/logger";
import { getTodayInTimezone } from "./getTodayInTimezone";
import { addDays } from "./addDays";
import { resolveSelectedStocks } from "./resolveSelectedStocks";

/**
 * "each" mode: For each selected stock, compute "today" in that stock's
 * market timezone, derive the target earnings date, and trigger if matched.
 */
export async function handleEachMode(
  ctx: ActionCtx,
  schedule: Doc<"schedules">,
  config: NonNullable<Doc<"schedules">["earningsConfig"]>
) {
  const selectedStocks = await resolveSelectedStocks(ctx, schedule);
  if (selectedStocks.length === 0) return;

  // Group stocks by market timezone to minimize date computations
  const tzGroups = new Map<string, Doc<"stocks">[]>();
  for (const stock of selectedStocks) {
    const tz = getMarketTimezone(stock.exchange);
    const group = tzGroups.get(tz) ?? [];
    group.push(stock);
    tzGroups.set(tz, group);
  }

  // Timezone groups (and earnings records within them) are independent,
  // so all dedup checks and job creations run in parallel.
  const groupTriggered = await Promise.all(
    [...tzGroups].map(async ([tz, stocks]) => {
      const today = getTodayInTimezone(tz);
      const targetEarningsDate = addDays(today, -config.offsetDays);

      // Query earnings on this target date
      const earningsRecords: Doc<"earnings">[] = await ctx.runQuery(
        internal.earnings.queries.internalGetEarningsByDate
          .internalGetEarningsByDate,
        { date: targetEarningsDate }
      );
      if (earningsRecords.length === 0) return false;

      // Filter to only stocks in this timezone group
      const stockIdSet = new Set(stocks.map((s) => s._id as string));
      const eligible = earningsRecords.filter((e) =>
        stockIdSet.has(e.stockId as string)
      );

      const triggered = await Promise.all(
        eligible.map(async (earnings) => {
          if (
            config.adjustForHour &&
            config.offsetDays === 0 &&
            earnings.hour === "amc"
          )
            return false;

          const alreadyTriggered = await ctx.runQuery(
            internal.earnings.queries.internalCheckAlreadyTriggered
              .internalCheckAlreadyTriggered,
            { scheduleId: schedule._id, earningsId: earnings._id }
          );
          if (alreadyTriggered) return false;

          try {
            const jobId = await ctx.runMutation(
              internal.schedules.mutations.internalCreateScheduledJob
                .internalCreateScheduledJob,
              {
                promptId: schedule.promptId,
                stockIds: [earnings.stockId],
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
                earningsId: earnings._id,
                stockId: earnings.stockId,
                earningsDate: earnings.date,
                jobId: jobId as Id<"researchJobs">,
              }
            );
            logger.info(
              `Earnings trigger [each]: job for stock ${earnings.stockId} (${earnings.date}, tz=${tz}, schedule "${schedule.name}")`
            );
            return true;
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Unknown error";
            logger.error(
              `Earnings trigger failed for stock ${earnings.stockId}, schedule "${schedule.name}": ${message}`
            );
            return false;
          }
        })
      );
      return triggered.some(Boolean);
    })
  );

  if (groupTriggered.some(Boolean)) {
    await ctx.runMutation(
      internal.earnings.mutations.internalUpdateScheduleLastRunAt
        .internalUpdateScheduleLastRunAt,
      {
        id: schedule._id,
      }
    );
  }
}
