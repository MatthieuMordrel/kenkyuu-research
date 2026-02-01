import { query } from "./_generated/server";

/** Recent research: last 5 completed or failed jobs with prompt and stock info. */
export const recentResearch = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db
      .query("researchJobs")
      .order("desc")
      .take(20);

    // Filter to completed/failed and take 5
    const recent = jobs
      .filter((j) => j.status === "completed" || j.status === "failed")
      .slice(0, 5);

    // Enrich with prompt name and stock tickers
    const enriched = await Promise.all(
      recent.map(async (job) => {
        const prompt = await ctx.db.get(job.promptId);
        const stocks = await Promise.all(
          job.stockIds.map((id) => ctx.db.get(id)),
        );
        return {
          _id: job._id,
          status: job.status,
          promptName: prompt?.name ?? "Deleted prompt",
          promptType: prompt?.type,
          stockTickers: stocks
            .filter((s) => s !== null)
            .map((s) => s.ticker),
          costUsd: job.costUsd,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          error: job.error,
        };
      }),
    );

    return enriched;
  },
});

/** Upcoming scheduled runs sorted by next run time. */
export const upcomingSchedules = query({
  args: {},
  handler: async (ctx) => {
    const schedules = await ctx.db.query("schedules").collect();

    const upcoming = schedules
      .filter((s) => s.enabled && s.nextRunAt !== undefined)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        promptId: s.promptId,
        nextRunAt: s.nextRunAt!,
        cron: s.cron,
        timezone: s.timezone,
      }))
      .toSorted((a, b) => a.nextRunAt - b.nextRunAt)
      .slice(0, 5);

    // Enrich with prompt names
    const enriched = await Promise.all(
      upcoming.map(async (s) => {
        const prompt = await ctx.db.get(s.promptId);
        Object.assign(s, { promptName: prompt?.name ?? "Deleted prompt" });
        return s as typeof s & { promptName: string };
      }),
    );

    return enriched;
  },
});

/** Monthly spend: total cost and job count for the current calendar month. */
export const monthlySpend = query({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).getTime();
    const startOfNextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
    ).getTime();

    const logs = await ctx.db
      .query("costLogs")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", startOfMonth).lt("timestamp", startOfNextMonth),
      )
      .collect();

    const totalCost = logs.reduce((sum, log) => sum + log.costUsd, 0);

    // Get budget threshold from settings
    const budgetSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "budget_threshold"))
      .unique();

    const budgetThreshold = budgetSetting
      ? Number.parseFloat(budgetSetting.value)
      : undefined;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      jobCount: logs.length,
      budgetThreshold:
        budgetThreshold !== undefined && !Number.isNaN(budgetThreshold)
          ? budgetThreshold
          : undefined,
    };
  },
});

/** Active jobs count: number of pending + running jobs and the max limit. */
export const activeJobsCount = query({
  args: {},
  handler: async (ctx) => {
    const pendingJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    return {
      pending: pendingJobs.length,
      running: runningJobs.length,
      total: pendingJobs.length + runningJobs.length,
      limit: 5,
    };
  },
});
