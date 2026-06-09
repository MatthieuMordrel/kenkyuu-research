import type { QueryCtx } from "../../_generated/server";
import { loadActiveJobsForConcurrency } from "./loadActiveJobsForConcurrency";
import { loadFormattingJobs } from "./loadFormattingJobs";

/**
 * Pending, running, and formatting jobs for UI "active" surfaces.
 * Concurrency snapshots still use {@link loadActiveJobsForConcurrency} only.
 */
export async function loadDisplayActiveJobs(ctx: QueryCtx) {
  const [concurrencyJobs, formattingJobs] = await Promise.all([
    loadActiveJobsForConcurrency(ctx),
    loadFormattingJobs(ctx),
  ]);
  return [...concurrencyJobs, ...formattingJobs];
}
