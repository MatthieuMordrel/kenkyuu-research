"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { getMarketTimezone } from "./lib/exchangeTimezones";

// --- Helper: compute today's date string in a timezone ---

export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD
  return formatter.format(now);
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid DST issues
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Get the fiscal quarter key from earnings records, e.g. "Q1-2026" */
function getQuarterKey(quarter: number, year: number): string {
  return `Q${quarter}-${year}`;
}

/** Get the current reporting quarter: earnings reported now are typically for the prior quarter */
function getCurrentReportingQuarter(today: string): {
  quarter: number;
  year: number;
} {
  const d = new Date(today + "T12:00:00Z");
  const month = d.getUTCMonth() + 1; // 1-12
  const year = d.getUTCFullYear();
  // Reporting seasons: Jan-Mar report Q4 of prior year, Apr-Jun report Q1, Jul-Sep report Q2, Oct-Dec report Q3
  if (month <= 3) return { quarter: 4, year: year - 1 };
  if (month <= 6) return { quarter: 1, year };
  if (month <= 9) return { quarter: 2, year };
  return { quarter: 3, year };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionCtx = any;

/** Resolve all stock IDs from a schedule's stock selection */
async function resolveSelectedStocks(
  ctx: ActionCtx,
  schedule: Doc<"schedules">
): Promise<Doc<"stocks">[]> {
  if (schedule.stockSelection.type === "all") {
    return await ctx.runQuery(internal.schedules.listStocksInternal, {});
  }
  if (schedule.stockSelection.type === "specific") {
    const ids = schedule.stockSelection.stockIds ?? [];
    if (ids.length === 0) return [];
    return await ctx.runQuery(internal.earningsTriggers.getStocksByIds, {
      stockIds: ids,
    });
  }
  if (schedule.stockSelection.type === "tagged") {
    const allStocks: Doc<"stocks">[] = await ctx.runQuery(
      internal.schedules.listStocksInternal,
      {}
    );
    const tagSet = new Set(schedule.stockSelection.tags ?? []);
    return allStocks.filter((s) => s.tags.some((t: string) => tagSet.has(t)));
  }
  return [];
}

// --- Helper: resolve stock IDs from stock selection intersected with earnings ---

async function resolveEligibleStocks(
  ctx: ActionCtx,
  schedule: Doc<"schedules">,
  earningsRecords: Doc<"earnings">[]
): Promise<
  Array<{
    stockId: Id<"stocks">;
    earningsId: Id<"earnings">;
    earningsDate: string;
    hour?: string;
  }>
> {
  const earningsStockIds = new Set(
    earningsRecords.map((e) => e.stockId as string)
  );

  let eligibleStockIds: Set<string>;

  if (schedule.stockSelection.type === "all") {
    eligibleStockIds = earningsStockIds;
  } else if (schedule.stockSelection.type === "specific") {
    const specifiedIds = new Set(
      (schedule.stockSelection.stockIds ?? []).map((id) => id as string)
    );
    eligibleStockIds = new Set(
      [...earningsStockIds].filter((id) => specifiedIds.has(id))
    );
  } else if (schedule.stockSelection.type === "tagged") {
    const allStocks = await ctx.runQuery(
      internal.schedules.listStocksInternal,
      {}
    );
    const tagSet = new Set(schedule.stockSelection.tags ?? []);
    const taggedStockIds = new Set(
      (allStocks as Doc<"stocks">[])
        .filter((s: Doc<"stocks">) => s.tags.some((t: string) => tagSet.has(t)))
        .map((s: Doc<"stocks">) => s._id as string)
    );
    eligibleStockIds = new Set(
      [...earningsStockIds].filter((id) => taggedStockIds.has(id))
    );
  } else {
    return [];
  }

  return earningsRecords
    .filter((e) => eligibleStockIds.has(e.stockId as string))
    .map((e) => ({
      stockId: e.stockId,
      earningsId: e._id,
      earningsDate: e.date,
      hour: e.hour,
    }));
}

// --- Main Action ---

/**
 * Hourly cron action that checks all earnings-type schedules and
 * creates research jobs for stocks with earnings matching the configured offset.
 *
 * For "each" mode: evaluates each stock's earnings date in that stock's market timezone
 * (derived from its exchange). Stocks in different markets can trigger on different
 * UTC days because "today" is computed per-stock.
 *
 * For "after_last"/"before_first" modes: uses the anchor stock's market timezone
 * to determine "today" for the aggregate trigger decision.
 */
export const checkEarningsTriggers = internalAction({
  args: {},
  handler: async (ctx) => {
    // Check global pause
    const globalPaused = await ctx.runQuery(
      internal.schedules.getGlobalPauseStatusInternal,
      {}
    );
    if (globalPaused) {
      return;
    }

    // Get all enabled earnings-type schedules
    const schedules = await ctx.runQuery(
      internal.earningsTriggers.getEarningsSchedules,
      {}
    );

    if (schedules.length === 0) {
      return;
    }

    for (const schedule of schedules) {
      const config = schedule.earningsConfig!;
      const earningsMode = config.earningsMode ?? "each";

      if (earningsMode === "each") {
        // --- "each" mode: trigger per stock using per-stock market timezone ---
        await handleEachMode(ctx, schedule, config);
      } else {
        // --- "after_last" or "before_first" mode: aggregate trigger ---
        await handleAggregateMode(ctx, schedule, config, earningsMode);
      }
    }
  },
});

/**
 * "each" mode: For each selected stock, compute "today" in that stock's
 * market timezone, derive the target earnings date, and trigger if matched.
 */
async function handleEachMode(
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

  let triggeredAny = false;

  for (const [tz, stocks] of tzGroups) {
    const today = getTodayInTimezone(tz);
    const targetEarningsDate = addDays(today, -config.offsetDays);

    // Query earnings on this target date
    const earningsRecords: Doc<"earnings">[] = await ctx.runQuery(
      internal.earningsTriggers.getEarningsByDate,
      { date: targetEarningsDate }
    );
    if (earningsRecords.length === 0) continue;

    // Filter to only stocks in this timezone group
    const stockIdSet = new Set(stocks.map((s) => s._id as string));
    const eligible = earningsRecords.filter((e) =>
      stockIdSet.has(e.stockId as string)
    );

    for (const earnings of eligible) {
      if (
        config.adjustForHour &&
        config.offsetDays === 0 &&
        earnings.hour === "amc"
      )
        continue;

      const alreadyTriggered = await ctx.runQuery(
        internal.earningsTriggers.checkAlreadyTriggered,
        { scheduleId: schedule._id, earningsId: earnings._id }
      );
      if (alreadyTriggered) continue;

      try {
        const jobId = await ctx.runMutation(
          internal.schedules.createScheduledJob,
          {
            promptId: schedule.promptId,
            stockIds: [earnings.stockId],
            provider: schedule.provider,
            scheduleId: schedule._id,
          }
        );
        await ctx.runMutation(internal.earningsTriggers.recordTriggeredRun, {
          scheduleId: schedule._id,
          earningsId: earnings._id,
          stockId: earnings.stockId,
          earningsDate: earnings.date,
          jobId: jobId as Id<"researchJobs">,
        });
        triggeredAny = true;
        console.log(
          `Earnings trigger [each]: job for stock ${earnings.stockId} (${earnings.date}, tz=${tz}, schedule "${schedule.name}")`
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `Earnings trigger failed for stock ${earnings.stockId}, schedule "${schedule.name}": ${message}`
        );
        if (message.includes("concurrent jobs")) break;
      }
    }
  }

  if (triggeredAny) {
    await ctx.runMutation(internal.earningsTriggers.updateScheduleLastRunAt, {
      id: schedule._id,
    });
  }
}

/**
 * "after_last" and "before_first" modes: aggregate trigger that waits for
 * all/first stock(s) to report. Uses the anchor stock's market timezone.
 */
async function handleAggregateMode(
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
  const prompt = await ctx.runQuery(internal.prompts.getPromptInternal, {
    id: schedule.promptId,
  });
  const isSingleStock = prompt?.type === "single-stock";

  // Get all earnings for selected stocks
  const allEarnings: Doc<"earnings">[] = await ctx.runQuery(
    internal.earningsTriggers.getEarningsForStocks,
    { stockIds: selectedStockIds }
  );

  // Use the most common market timezone among selected stocks for "today" computation.
  // This is the timezone of the majority of stocks — a reasonable anchor for aggregate modes.
  const tzCounts = new Map<string, number>();
  for (const tz of stockTimezoneMap.values()) {
    tzCounts.set(tz, (tzCounts.get(tz) ?? 0) + 1);
  }
  const anchorTz =
    [...tzCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "America/New_York";
  const today = getTodayInTimezone(anchorTz);

  // Find the current reporting quarter
  const { quarter, year } = getCurrentReportingQuarter(today);
  const qKey = getQuarterKey(quarter, year);

  // Check dedup: already triggered for this quarter?
  const alreadyTriggered = await ctx.runQuery(
    internal.earningsTriggers.checkAlreadyTriggeredForQuarter,
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
        for (const stockId of selectedStockIds) {
          try {
            await ctx.runMutation(internal.schedules.createScheduledJob, {
              promptId: schedule.promptId,
              stockIds: [stockId],
              provider: schedule.provider,
              scheduleId: schedule._id,
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Unknown error";
            console.error(
              `Earnings trigger [after_last] failed for stock ${stockId}, schedule "${schedule.name}": ${message}`
            );
            if (message.includes("concurrent jobs")) break;
          }
        }
      } else {
        await ctx.runMutation(internal.schedules.createScheduledJob, {
          promptId: schedule.promptId,
          stockIds: selectedStockIds,
          provider: schedule.provider,
          scheduleId: schedule._id,
        });
      }
      await ctx.runMutation(internal.earningsTriggers.recordTriggeredRun, {
        scheduleId: schedule._id,
        earningsId: anchorEarnings._id,
        stockId: anchorEarnings.stockId,
        earningsDate: latestDate,
        jobId: undefined,
        quarterKey: qKey,
      });
      console.log(
        `Earnings trigger [after_last]: ${isSingleStock ? "per-stock jobs" : "job"} for ${selectedStockIds.length} stocks (${qKey}, tz=${anchorTz}, schedule "${schedule.name}")`
      );
      await ctx.runMutation(internal.earningsTriggers.updateScheduleLastRunAt, {
        id: schedule._id,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(
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
        for (const stockId of selectedStockIds) {
          try {
            await ctx.runMutation(internal.schedules.createScheduledJob, {
              promptId: schedule.promptId,
              stockIds: [stockId],
              provider: schedule.provider,
              scheduleId: schedule._id,
            });
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : "Unknown error";
            console.error(
              `Earnings trigger [before_first] failed for stock ${stockId}, schedule "${schedule.name}": ${message}`
            );
            if (message.includes("concurrent jobs")) break;
          }
        }
      } else {
        await ctx.runMutation(internal.schedules.createScheduledJob, {
          promptId: schedule.promptId,
          stockIds: selectedStockIds,
          provider: schedule.provider,
          scheduleId: schedule._id,
        });
      }
      await ctx.runMutation(internal.earningsTriggers.recordTriggeredRun, {
        scheduleId: schedule._id,
        earningsId: anchorEarnings._id,
        stockId: anchorEarnings.stockId,
        earningsDate: earliestDate,
        jobId: undefined,
        quarterKey: qKey,
      });
      console.log(
        `Earnings trigger [before_first]: ${isSingleStock ? "per-stock jobs" : "job"} for ${selectedStockIds.length} stocks (${qKey}, tz=${anchorTz}, schedule "${schedule.name}")`
      );
      await ctx.runMutation(internal.earningsTriggers.updateScheduleLastRunAt, {
        id: schedule._id,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Earnings trigger [before_first] failed for schedule "${schedule.name}": ${message}`
      );
    }
  }
}

/**
 * Test/dry-run action that simulates the earnings trigger for a given date.
 * Uses per-stock market timezones to compute today, but accepts an overrideDate
 * to simulate a specific day.
 */
export const testCheckEarningsTriggers = internalAction({
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

    console.log(
      `[TEST] Simulating earnings triggers for date=${simulatedToday}, dryRun=${isDryRun}`
    );

    const schedules: Doc<"schedules">[] = await ctx.runQuery(
      internal.earningsTriggers.getEarningsSchedules,
      {}
    );

    if (schedules.length === 0) {
      console.log("[TEST] No enabled earnings-type schedules found.");
      return { schedulesChecked: 0, matchesFound: [] };
    }

    console.log(`[TEST] Found ${schedules.length} earnings schedule(s)`);

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

    for (const schedule of schedules) {
      const config = schedule.earningsConfig!;
      const targetEarningsDate = addDays(simulatedToday, -config.offsetDays);

      console.log(
        `[TEST] Schedule "${schedule.name}": offset=${config.offsetDays}d, target earnings date=${targetEarningsDate}`
      );

      const earningsRecords = await ctx.runQuery(
        internal.earningsTriggers.getEarningsByDate,
        { date: targetEarningsDate }
      );

      if (earningsRecords.length === 0) {
        console.log(`[TEST]   No earnings found for ${targetEarningsDate}`);
        continue;
      }

      console.log(
        `[TEST]   Found ${earningsRecords.length} earnings record(s) on ${targetEarningsDate}`
      );

      const eligible = await resolveEligibleStocks(
        ctx,
        schedule,
        earningsRecords
      );

      for (const { stockId, earningsId, earningsDate, hour } of eligible) {
        const wouldSkipAmc =
          config.adjustForHour && config.offsetDays === 0 && hour === "amc";

        const alreadyTriggered = await ctx.runQuery(
          internal.earningsTriggers.checkAlreadyTriggered,
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

        const match = {
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
        allMatches.push(match);

        console.log(
          `[TEST]   Stock ${stockId}: hour=${hour ?? "unknown"}, ${action}`
        );

        // Actually trigger if not dry run and not skipped
        if (!isDryRun && !wouldSkipAmc && !alreadyTriggered) {
          try {
            const jobId = await ctx.runMutation(
              internal.schedules.createScheduledJob,
              {
                promptId: schedule.promptId,
                stockIds: [stockId],
                provider: schedule.provider,
                scheduleId: schedule._id,
              }
            );
            await ctx.runMutation(
              internal.earningsTriggers.recordTriggeredRun,
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
            console.error(`[TEST]   Error creating job: ${message}`);
          }
        }
      }
    }

    console.log(
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
