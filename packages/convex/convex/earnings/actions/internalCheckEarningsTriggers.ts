"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { handleEachMode } from "../shared/handleEachMode";
import { handleAggregateMode } from "../shared/handleAggregateMode";

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
export const internalCheckEarningsTriggers = internalAction({
  args: {},
  handler: async (ctx) => {
    // Check global pause
    const globalPaused = await ctx.runQuery(
      internal.schedules.queries.internalGetGlobalPauseStatus
        .internalGetGlobalPauseStatus,
      {}
    );
    if (globalPaused) {
      return;
    }

    // Get all enabled earnings-type schedules
    const schedules = await ctx.runQuery(
      internal.earnings.queries.internalGetEarningsSchedules
        .internalGetEarningsSchedules,
      {}
    );

    if (schedules.length === 0) {
      return;
    }

    // Schedules are independent of each other; evaluate them in parallel.
    await Promise.all(
      schedules.map(async (schedule) => {
        const config = schedule.earningsConfig!;
        const earningsMode = config.earningsMode ?? "each";

        if (earningsMode === "each") {
          // --- "each" mode: trigger per stock using per-stock market timezone ---
          await handleEachMode(ctx, schedule, config);
        } else {
          // --- "after_last" or "before_first" mode: aggregate trigger ---
          await handleAggregateMode(ctx, schedule, config, earningsMode);
        }
      })
    );
  },
});
