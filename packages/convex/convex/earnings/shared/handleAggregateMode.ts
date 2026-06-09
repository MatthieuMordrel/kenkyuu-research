import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { getMarketTimezone } from "../../lib/exchangeTimezones";
import { logger } from "../../lib/logger";
import { getTodayInTimezone } from "./getTodayInTimezone";
import { addDays } from "./addDays";
import { getQuarterKey } from "./getQuarterKey";
import { getCurrentReportingQuarter } from "./getCurrentReportingQuarter";
import { resolveSelectedStocks } from "./resolveSelectedStocks";

/**
 * "after_last" and "before_first" modes: aggregate trigger that waits for
 * all/first stock(s) to report. Uses the anchor stock's market timezone.
 */
export async function handleAggregateMode(
  ctx: ActionCtx,
  schedule: Doc<"schedules">,
  config: NonNullable<Doc<"schedules">["earningsConfig"]>,
  earningsMode: "after_last" | "before_first"
) {
  const selectedStocks = await resolveSelectedStocks(ctx, schedule);
  if (selectedStocks.length === 0) return;

  const selectedStockIds = selectedStocks.map((s) => s._id);
  const stockTimezoneMap = new Map<string, string>();
  for (const stock of selectedStocks) {
    stockTimezoneMap.set(
      stock._id as string,
      getMarketTimezone(stock.exchange)
    );
  }

  // Check prompt type for single-stock handling
  const prompt = await ctx.runQuery(
    internal.prompts.queries.internalGetPrompt.internalGetPrompt,
    {
      id: schedule.promptId,
    }
  );
  const isSingleStock = prompt?.type === "single-stock";

  // Get all earnings for selected stocks
  const allEarnings: Doc<"earnings">[] = await ctx.runQuery(
    internal.earnings.queries.internalGetEarningsForStocks
      .internalGetEarningsForStocks,
    { stockIds: selectedStockIds }
  );

  // Use the most common market timezone among selected stocks for "today" computation.
  // This is the timezone of the majority of stocks — a reasonable anchor for aggregate modes.
  const tzCounts = new Map<string, number>();
  for (const tz of stockTimezoneMap.values()) {
    tzCounts.set(tz, (tzCounts.get(tz) ?? 0) + 1);
  }
  const anchorTz =
    [...tzCounts.entries()].toSorted((a, b) => b[1] - a[1])[0]?.[0] ??
    "America/New_York";
  const today = getTodayInTimezone(anchorTz);

  // Find the current reporting quarter
  const { quarter, year } = getCurrentReportingQuarter(today);
  const qKey = getQuarterKey(quarter, year);

  // Check dedup: already triggered for this quarter?
  const alreadyTriggered = await ctx.runQuery(
    internal.earnings.queries.internalCheckAlreadyTriggeredForQuarter
      .internalCheckAlreadyTriggeredForQuarter,
    { scheduleId: schedule._id, quarterKey: qKey }
  );
  if (alreadyTriggered) return;

  // Filter earnings to this quarter
  const quarterEarnings = allEarnings.filter(
    (e) => e.quarter === quarter && e.year === year
  );

  if (quarterEarnings.length === 0) return;

  // Group by stockId to find each stock's earnings date
  const stockEarningsMap = new Map<string, Doc<"earnings">>();
  for (const e of quarterEarnings) {
    const existing = stockEarningsMap.get(e.stockId as string);
    // Keep the latest entry per stock if multiple exist
    if (!existing || e.date > existing.date) {
      stockEarningsMap.set(e.stockId as string, e);
    }
  }

  if (earningsMode === "after_last") {
    // Need ALL selected stocks to have reported
    const allHaveEarnings = selectedStockIds.every((id) =>
      stockEarningsMap.has(id as string)
    );

    // Deadline: if we're past quarter-end + 45 days, trigger anyway with whatever we have
    const quarterEndMonth = quarter * 3; // Q1->3, Q2->6, Q3->9, Q4->12
    const quarterEndYear = quarter === 4 ? year + 1 : year;
    const deadlineDate = addDays(
      `${quarterEndYear}-${String(quarterEndMonth).padStart(2, "0")}-28`,
      45
    );
    const pastDeadline = today >= deadlineDate;

    if (!allHaveEarnings && !pastDeadline) return;

    // Find the latest earnings date among stocks that have reported
    const reportedEarnings = [...stockEarningsMap.values()];
    const latestDate = reportedEarnings.reduce(
      (max, e) => (e.date > max ? e.date : max),
      reportedEarnings[0]!.date
    );

    // Check if today >= latestDate + offset
    const triggerDate = addDays(latestDate, config.offsetDays);
    if (today < triggerDate && !pastDeadline) return;

    // Trigger
    const anchorEarnings = reportedEarnings.find((e) => e.date === latestDate)!;
    try {
      if (isSingleStock) {
        // Per-stock jobs are independent; create them in parallel.
        await Promise.all(
          selectedStockIds.map(async (stockId) => {
            try {
              await ctx.runMutation(
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
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : "Unknown error";
              logger.error(
                `Earnings trigger [after_last] failed for stock ${stockId}, schedule "${schedule.name}": ${message}`
              );
            }
          })
        );
      } else {
        await ctx.runMutation(
          internal.schedules.mutations.internalCreateScheduledJob
            .internalCreateScheduledJob,
          {
            promptId: schedule.promptId,
            stockIds: selectedStockIds,
            provider: schedule.provider,
            modelId: schedule.modelId,
            scheduleId: schedule._id,
          }
        );
      }
      await ctx.runMutation(
        internal.earnings.mutations.internalRecordTriggeredRun
          .internalRecordTriggeredRun,
        {
          scheduleId: schedule._id,
          earningsId: anchorEarnings._id,
          stockId: anchorEarnings.stockId,
          earningsDate: latestDate,
          jobId: undefined,
          quarterKey: qKey,
        }
      );
      logger.info(
        `Earnings trigger [after_last]: ${isSingleStock ? "per-stock jobs" : "job"} for ${selectedStockIds.length} stocks (${qKey}, tz=${anchorTz}, schedule "${schedule.name}")`
      );
      await ctx.runMutation(
        internal.earnings.mutations.internalUpdateScheduleLastRunAt
          .internalUpdateScheduleLastRunAt,
        {
          id: schedule._id,
        }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        `Earnings trigger [after_last] failed for schedule "${schedule.name}": ${message}`
      );
    }
  } else {
    // "before_first" mode
    const reportedEarnings = [...stockEarningsMap.values()];
    const earliestDate = reportedEarnings.reduce(
      (min, e) => (e.date < min ? e.date : min),
      reportedEarnings[0]!.date
    );

    // Check if today >= earliestDate + offset (offset is typically negative for "before")
    const triggerDate = addDays(earliestDate, config.offsetDays);
    if (today < triggerDate) return;

    const anchorEarnings = reportedEarnings.find(
      (e) => e.date === earliestDate
    )!;
    try {
      if (isSingleStock) {
        // Per-stock jobs are independent; create them in parallel.
        await Promise.all(
          selectedStockIds.map(async (stockId) => {
            try {
              await ctx.runMutation(
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
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : "Unknown error";
              logger.error(
                `Earnings trigger [before_first] failed for stock ${stockId}, schedule "${schedule.name}": ${message}`
              );
            }
          })
        );
      } else {
        await ctx.runMutation(
          internal.schedules.mutations.internalCreateScheduledJob
            .internalCreateScheduledJob,
          {
            promptId: schedule.promptId,
            stockIds: selectedStockIds,
            provider: schedule.provider,
            modelId: schedule.modelId,
            scheduleId: schedule._id,
          }
        );
      }
      await ctx.runMutation(
        internal.earnings.mutations.internalRecordTriggeredRun
          .internalRecordTriggeredRun,
        {
          scheduleId: schedule._id,
          earningsId: anchorEarnings._id,
          stockId: anchorEarnings.stockId,
          earningsDate: earliestDate,
          jobId: undefined,
          quarterKey: qKey,
        }
      );
      logger.info(
        `Earnings trigger [before_first]: ${isSingleStock ? "per-stock jobs" : "job"} for ${selectedStockIds.length} stocks (${qKey}, tz=${anchorTz}, schedule "${schedule.name}")`
      );
      await ctx.runMutation(
        internal.earnings.mutations.internalUpdateScheduleLastRunAt
          .internalUpdateScheduleLastRunAt,
        {
          id: schedule._id,
        }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        `Earnings trigger [before_first] failed for schedule "${schedule.name}": ${message}`
      );
    }
  }
}
