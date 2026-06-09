"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { logger } from "../../lib/logger";

// Stale threshold for the recovery cron (runs every 15 min).
const STALE_JOB_THRESHOLD_MS = 30 * 60_000;

/** Cron every 15 min; catches dropped webhooks and stalled polls. */
export const recoverStaleJobs = internalAction({
  args: {},
  handler: async (ctx) => {
    const staleJobs = await ctx.runQuery(
      internal.research.queries.getStaleRunningJobs.getStaleRunningJobs,
      { staleThresholdMs: STALE_JOB_THRESHOLD_MS }
    );

    // Stale jobs are independent; poll them in parallel.
    await Promise.all(
      staleJobs.map(async (job) => {
        try {
          await ctx.runAction(internal.research.actions.pollJob.pollJob, {
            jobId: job._id,
          });
        } catch (error) {
          logger.error(
            `recoverStaleJobs: pollJob failed for ${job._id}:`,
            error instanceof Error ? error.message : error
          );
        }
      })
    );
  },
});
