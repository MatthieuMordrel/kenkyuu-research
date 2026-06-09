import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Ops diagnostic: returns the N most recent jobs stripped of their long
 * template text, for inspection via `bunx convex run`.
 */
export const debugListRecentJobs = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(Math.min(args.limit ?? 5, 20));
    return jobs.map((j) => ({
      _id: j._id,
      createdAt: new Date(j.createdAt).toISOString(),
      provider: j.provider,
      status: j.status,
      attempts: j.attempts,
      externalJobId: j.externalJobId,
      error: j.error,
      costUsd: j.costUsd,
      durationMs: j.durationMs,
      completedAt: j.completedAt
        ? new Date(j.completedAt).toISOString()
        : undefined,
    }));
  },
});
