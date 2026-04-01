"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";

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

// --- Helper: resolve stock IDs from stock selection intersected with earnings ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionCtx = any;

async function resolveEligibleStocks(
  ctx: ActionCtx,
  schedule: Doc<"schedules">,
  earningsRecords: Doc<"earnings">[],
): Promise<Array<{ stockId: Id<"stocks">; earningsId: Id<"earnings">; earningsDate: string; hour?: string }>> {
  const earningsStockIds = new Set(earningsRecords.map((e) => e.stockId as string));

  let eligibleStockIds: Set<string>;

  if (schedule.stockSelection.type === "all") {
    eligibleStockIds = earningsStockIds;
  } else if (schedule.stockSelection.type === "specific") {
    const specifiedIds = new Set(
      (schedule.stockSelection.stockIds ?? []).map((id) => id as string),
    );
    eligibleStockIds = new Set(
      [...earningsStockIds].filter((id) => specifiedIds.has(id)),
    );
  } else if (schedule.stockSelection.type === "tagged") {
    const allStocks = await ctx.runQuery(
      internal.schedules.listStocksInternal,
      {},
    );
    const tagSet = new Set(schedule.stockSelection.tags ?? []);
    const taggedStockIds = new Set(
      (allStocks as Doc<"stocks">[])
        .filter((s: Doc<"stocks">) => s.tags.some((t: string) => tagSet.has(t)))
        .map((s: Doc<"stocks">) => s._id as string),
    );
    eligibleStockIds = new Set(
      [...earningsStockIds].filter((id) => taggedStockIds.has(id)),
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
 */
export const checkEarningsTriggers = internalAction({
  args: {},
  handler: async (ctx) => {
    // Check global pause
    const globalPaused = await ctx.runQuery(
      internal.schedules.getGlobalPauseStatusInternal,
      {},
    );
    if (globalPaused) {
      return;
    }

    // Get all enabled earnings-type schedules
    const schedules = await ctx.runQuery(
      internal.earningsTriggers.getEarningsSchedules,
      {},
    );

    if (schedules.length === 0) {
      return;
    }

    for (const schedule of schedules) {
      const config = schedule.earningsConfig!;
      const today = getTodayInTimezone(schedule.timezone);

      // Compute target earnings date:
      // If offsetDays = 0, we want earnings ON today -> target = today
      // If offsetDays = 1, we want to trigger 1 day AFTER earnings -> target = today - 1
      // If offsetDays = -1, we want to trigger 1 day BEFORE earnings -> target = today + 1
      const targetEarningsDate = addDays(today, -config.offsetDays);

      // Query earnings for the target date
      const earningsRecords = await ctx.runQuery(
        internal.earningsTriggers.getEarningsByDate,
        { date: targetEarningsDate },
      );

      if (earningsRecords.length === 0) {
        continue;
      }

      // Resolve eligible stocks based on stock selection
      const eligible = await resolveEligibleStocks(ctx, schedule, earningsRecords);

      let triggeredAny = false;

      for (const { stockId, earningsId, earningsDate, hour } of eligible) {
        // Handle adjustForHour: skip amc earnings at offset=0 (they'll be picked up tomorrow)
        if (config.adjustForHour && config.offsetDays === 0 && hour === "amc") {
          continue;
        }

        // Check deduplication
        const alreadyTriggered = await ctx.runQuery(
          internal.earningsTriggers.checkAlreadyTriggered,
          { scheduleId: schedule._id, earningsId },
        );

        if (alreadyTriggered) {
          continue;
        }

        // Create research job
        try {
          const jobId = await ctx.runMutation(
            internal.schedules.createScheduledJob,
            {
              promptId: schedule.promptId,
              stockIds: [stockId],
              provider: schedule.provider,
              scheduleId: schedule._id,
            },
          );

          // Record triggered run for deduplication
          await ctx.runMutation(
            internal.earningsTriggers.recordTriggeredRun,
            {
              scheduleId: schedule._id,
              earningsId,
              stockId,
              earningsDate,
              jobId: jobId as Id<"researchJobs">,
            },
          );

          triggeredAny = true;
          console.log(
            `Earnings trigger: created job for stock ${stockId} (earnings ${earningsDate}, offset ${config.offsetDays}d, schedule "${schedule.name}")`,
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error(
            `Earnings trigger failed for stock ${stockId}, schedule "${schedule.name}": ${message}`,
          );
          if (message.includes("concurrent jobs")) {
            console.log(
              `Concurrent job limit reached, deferring remaining stocks for schedule "${schedule.name}"`,
            );
            break;
          }
        }
      }

      if (triggeredAny) {
        await ctx.runMutation(
          internal.earningsTriggers.updateScheduleLastRunAt,
          { id: schedule._id },
        );
      }
    }
  },
});

/**
 * Test/dry-run action that simulates the earnings trigger for a given date.
 * - overrideDate: pretend "today" is this date (YYYY-MM-DD)
 * - dryRun: if true, logs what would happen without creating jobs or recording runs
 *
 * Invoke via Convex dashboard or CLI:
 *   npx convex run earningsTriggerActions:testCheckEarningsTriggers '{"overrideDate":"2026-04-15","dryRun":true}'
 */
export const testCheckEarningsTriggers = internalAction({
  args: {
    overrideDate: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
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
      `[TEST] Simulating earnings triggers for date=${simulatedToday}, dryRun=${isDryRun}`,
    );

    const schedules: Doc<"schedules">[] = await ctx.runQuery(
      internal.earningsTriggers.getEarningsSchedules,
      {},
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
        `[TEST] Schedule "${schedule.name}": offset=${config.offsetDays}d, target earnings date=${targetEarningsDate}`,
      );

      const earningsRecords = await ctx.runQuery(
        internal.earningsTriggers.getEarningsByDate,
        { date: targetEarningsDate },
      );

      if (earningsRecords.length === 0) {
        console.log(`[TEST]   No earnings found for ${targetEarningsDate}`);
        continue;
      }

      console.log(
        `[TEST]   Found ${earningsRecords.length} earnings record(s) on ${targetEarningsDate}`,
      );

      const eligible = await resolveEligibleStocks(ctx, schedule, earningsRecords);

      for (const { stockId, earningsId, earningsDate, hour } of eligible) {
        const wouldSkipAmc =
          config.adjustForHour && config.offsetDays === 0 && hour === "amc";

        const alreadyTriggered = await ctx.runQuery(
          internal.earningsTriggers.checkAlreadyTriggered,
          { scheduleId: schedule._id, earningsId },
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
          `[TEST]   Stock ${stockId}: hour=${hour ?? "unknown"}, ${action}`,
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
              },
            );
            await ctx.runMutation(
              internal.earningsTriggers.recordTriggeredRun,
              {
                scheduleId: schedule._id,
                earningsId,
                stockId,
                earningsDate,
                jobId: jobId as Id<"researchJobs">,
              },
            );
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown error";
            console.error(`[TEST]   Error creating job: ${message}`);
          }
        }
      }
    }

    console.log(
      `[TEST] Summary: ${schedules.length} schedule(s) checked, ${allMatches.length} match(es) found`,
    );

    return {
      simulatedDate: simulatedToday,
      dryRun: isDryRun,
      schedulesChecked: schedules.length,
      matchesFound: allMatches,
    };
  },
});
