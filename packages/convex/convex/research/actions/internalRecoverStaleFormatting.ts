"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { logger } from "../../lib/logger";
import { FORMAT_POLL_INITIAL_DELAY_MS } from "../shared/formatPollInitialDelayMs";

const FORMAT_STALE_THRESHOLD_MS = 20 * 60_000;

/**
 * Recovers jobs stuck in formatting (missed scheduler, deploy gap, etc.).
 */
export const internalRecoverStaleFormatting = internalAction({
  args: {},
  handler: async (ctx) => {
    const staleJobs = await ctx.runQuery(
      internal.research.queries.internalGetStaleFormattingJobs
        .internalGetStaleFormattingJobs,
      { staleThresholdMs: FORMAT_STALE_THRESHOLD_MS }
    );

    // Stale jobs are independent; recover them in parallel.
    await Promise.all(
      staleJobs.map(async (job) => {
        const mode = "pipeline" as const;
        try {
          if (job.formatExternalId) {
            await ctx.runAction(
              internal.research.actions.internalPollFormat.internalPollFormat,
              {
                jobId: job._id,
                mode,
                nextDelayMs: FORMAT_POLL_INITIAL_DELAY_MS,
              }
            );
          } else {
            await ctx.runAction(
              internal.research.actions.internalStartFormat.internalStartFormat,
              {
                jobId: job._id,
                mode,
              }
            );
          }
        } catch (error) {
          logger.error(
            `recoverStaleFormatting: failed for ${job._id}:`,
            error instanceof Error ? error.message : error
          );
        }
      })
    );
  },
});
