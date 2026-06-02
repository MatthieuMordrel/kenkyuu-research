import { BUILT_IN_DISCOVERY_PROMPT } from "@repo/research-models/research-prompt";
import { internalMutation } from "./_generated/server";

const BUILT_IN_PROMPTS = [
  {
    name: BUILT_IN_DISCOVERY_PROMPT.name,
    description: BUILT_IN_DISCOVERY_PROMPT.description,
    type: BUILT_IN_DISCOVERY_PROMPT.type,
    template: BUILT_IN_DISCOVERY_PROMPT.template,
    defaultModelId: "anthropic/claude-opus-4-8" as const,
    defaultProvider: "anthropic" as const,
    isBuiltIn: true,
  },
];

/**
 * One-off backfill: for every completed researchJob that has a costUsd but no
 * matching costLogs entry, insert the missing cost log row.
 * Run via: npx convex run seed:backfillCostLogs
 */
export const backfillCostLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const completedJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    let inserted = 0;
    let skipped = 0;

    for (const job of completedJobs) {
      if (job.costUsd === undefined) {
        skipped++;
        continue;
      }

      // Check if a cost log already exists for this job
      const existing = await ctx.db
        .query("costLogs")
        .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("costLogs", {
        jobId: job._id,
        provider: "openai",
        costUsd: job.costUsd,
        timestamp: job.completedAt ?? job.createdAt,
      });
      inserted++;
    }

    return { inserted, skipped };
  },
});

export const seedPrompts = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    const now = Date.now();

    for (const prompt of BUILT_IN_PROMPTS) {
      // Check existence by name using index instead of loading all prompts
      const existingPrompt = await ctx.db
        .query("prompts")
        .withIndex("by_name", (q) => q.eq("name", prompt.name))
        .first();
      if (!existingPrompt) {
        await ctx.db.insert("prompts", {
          ...prompt,
          createdAt: now,
          updatedAt: now,
        });
        inserted++;
      }
    }

    return { inserted, skipped: BUILT_IN_PROMPTS.length - inserted };
  },
});
