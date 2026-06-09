import type { ActionCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";

/** Loads a research job document by id (null when missing). */
export async function loadJob(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">
): Promise<Doc<"researchJobs"> | null> {
  return await ctx.runQuery(
    internal.research.queries.getJobInternal.getJobInternal,
    { id: jobId }
  );
}
