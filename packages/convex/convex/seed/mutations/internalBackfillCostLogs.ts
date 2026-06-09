import { internalMutation } from "../../_generated/server";

/**
 * One-off backfill: for every completed researchJob that has a costUsd but no
 * matching costLogs entry, insert the missing cost log row.
 * Run via: npx convex run seed/mutations/backfillCostLogs:backfillCostLogs
 */
export const internalBackfillCostLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const completedJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    // Each job is independent, so check-then-insert runs in parallel.
    // Convex mutations are transactional, so this stays consistent.
    const outcomes = await Promise.all(
      completedJobs.map(async (job) => {
        if (job.costUsd === undefined) {
          return "skipped" as const;
        }

        // Check if a cost log already exists for this job
        const existing = await ctx.db
          .query("costLogs")
          .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
          .first();

        if (existing) {
          return "skipped" as const;
        }

        await ctx.db.insert("costLogs", {
          jobId: job._id,
          provider: "openai",
          costUsd: job.costUsd,
          timestamp: job.completedAt ?? job.createdAt,
        });
        return "inserted" as const;
      })
    );

    const inserted = outcomes.filter((o) => o === "inserted").length;
    return { inserted, skipped: outcomes.length - inserted };
  },
});
