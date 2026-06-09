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

export const seedPrompts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Prompts have distinct names, so each check-then-insert is independent.
    const insertedFlags = await Promise.all(
      BUILT_IN_PROMPTS.map(async (prompt) => {
        // Check existence by name using index instead of loading all prompts
        const existingPrompt = await ctx.db
          .query("prompts")
          .withIndex("by_name", (q) => q.eq("name", prompt.name))
          .first();
        if (existingPrompt) {
          return false;
        }
        await ctx.db.insert("prompts", {
          ...prompt,
          createdAt: now,
          updatedAt: now,
        });
        return true;
      })
    );

    const inserted = insertedFlags.filter(Boolean).length;
    return { inserted, skipped: BUILT_IN_PROMPTS.length - inserted };
  },
});
