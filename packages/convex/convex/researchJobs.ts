import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";

const MAX_CONCURRENT_JOBS = 5;

const jobStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
);

// --- Mutations ---

export const createResearchJob = mutation({
  args: {
    promptId: v.id("prompts"),
    stockIds: v.array(v.id("stocks")),
    provider: v.literal("openai"),
    scheduleId: v.optional(v.id("schedules")),
  },
  handler: async (ctx, args) => {
    // Validate prompt exists and snapshot it
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Enforce concurrent job limit
    const activeJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    if (activeJobs.length + runningJobs.length >= MAX_CONCURRENT_JOBS) {
      throw new Error(
        `Maximum of ${MAX_CONCURRENT_JOBS} concurrent jobs allowed`,
      );
    }

    const now = Date.now();
    return await ctx.db.insert("researchJobs", {
      promptId: args.promptId,
      promptSnapshot: prompt.template,
      stockIds: args.stockIds,
      provider: args.provider,
      status: "pending",
      attempts: 0,
      scheduleId: args.scheduleId,
      createdAt: now,
    });
  },
});

export const createAndStartResearch = mutation({
  args: {
    promptId: v.id("prompts"),
    stockIds: v.array(v.id("stocks")),
    provider: v.literal("openai"),
    scheduleId: v.optional(v.id("schedules")),
  },
  handler: async (ctx, args) => {
    // Validate prompt exists and snapshot it
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Enforce concurrent job limit
    const activeJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    if (activeJobs.length + runningJobs.length >= MAX_CONCURRENT_JOBS) {
      throw new Error(
        `Maximum of ${MAX_CONCURRENT_JOBS} concurrent jobs allowed`,
      );
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("researchJobs", {
      promptId: args.promptId,
      promptSnapshot: prompt.template,
      stockIds: args.stockIds,
      provider: args.provider,
      status: "pending",
      attempts: 0,
      scheduleId: args.scheduleId,
      createdAt: now,
    });

    // Schedule the action to start immediately
    await ctx.scheduler.runAfter(
      0,
      internal.researchActions.startResearch,
      { jobId },
    );

    return jobId;
  },
});

export const updateJobStatus = internalMutation({
  args: {
    id: v.id("researchJobs"),
    status: jobStatus,
    externalJobId: v.optional(v.string()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    costUsd: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const job = await ctx.db.get(id);
    if (!job) {
      throw new Error("Research job not found");
    }

    const patch: Record<string, unknown> = { status: updates.status };

    if (updates.externalJobId !== undefined)
      patch.externalJobId = updates.externalJobId;
    if (updates.result !== undefined) patch.result = updates.result;
    if (updates.error !== undefined) patch.error = updates.error;
    if (updates.costUsd !== undefined) patch.costUsd = updates.costUsd;
    if (updates.durationMs !== undefined) patch.durationMs = updates.durationMs;

    if (updates.status === "completed" || updates.status === "failed") {
      patch.completedAt = Date.now();
    }

    await ctx.db.patch(id, patch);
    return id;
  },
});

export const incrementAttempts = internalMutation({
  args: {
    id: v.id("researchJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, { attempts: job.attempts + 1 });
    return job.attempts + 1;
  },
});

export const logCost = internalMutation({
  args: {
    jobId: v.id("researchJobs"),
    provider: v.literal("openai"),
    costUsd: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("costLogs", {
      jobId: args.jobId,
      provider: args.provider,
      costUsd: args.costUsd,
      timestamp: Date.now(),
    });
  },
});

export const cancelJob = mutation({
  args: {
    id: v.id("researchJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    if (job.status !== "pending" && job.status !== "running") {
      throw new Error(`Cannot cancel job with status "${job.status}"`);
    }

    await ctx.db.patch(args.id, {
      status: "failed",
      error: "Cancelled by user",
      completedAt: Date.now(),
    });

    return args.id;
  },
});

export const retryJob = mutation({
  args: {
    id: v.id("researchJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    if (job.status !== "failed") {
      throw new Error("Can only retry failed jobs");
    }

    if (job.attempts >= 3) {
      // Reset attempts to allow manual retry
      await ctx.db.patch(args.id, { attempts: 0 });
    }

    // Reset status and schedule retry
    await ctx.db.patch(args.id, {
      status: "pending",
      error: undefined,
      completedAt: undefined,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.researchActions.startResearch,
      { jobId: args.id },
    );

    return args.id;
  },
});

// --- Queries ---

export const listJobs = query({
  args: {
    status: v.optional(jobStatus),
    stockId: v.optional(v.id("stocks")),
    promptId: v.optional(v.id("prompts")),
  },
  handler: async (ctx, args) => {
    let jobs;

    if (args.status) {
      jobs = await ctx.db
        .query("researchJobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    } else if (args.promptId) {
      jobs = await ctx.db
        .query("researchJobs")
        .withIndex("by_promptId", (q) => q.eq("promptId", args.promptId!))
        .order("desc")
        .collect();
    } else {
      jobs = await ctx.db.query("researchJobs").order("desc").collect();
    }

    // Filter by stockId in memory (stockIds is an array)
    if (args.stockId) {
      jobs = jobs.filter((j) => j.stockIds.includes(args.stockId!));
    }

    return jobs;
  },
});

export const getJob = query({
  args: { id: v.id("researchJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getActiveJobs = query({
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
      jobs: [...pendingJobs, ...runningJobs],
      count: pendingJobs.length + runningJobs.length,
      limit: MAX_CONCURRENT_JOBS,
    };
  },
});

export const getJobInternal = internalQuery({
  args: { id: v.id("researchJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getStockInternal = internalQuery({
  args: { id: v.id("stocks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listResults = query({
  args: {
    status: v.optional(jobStatus),
    stockId: v.optional(v.id("stocks")),
    promptId: v.optional(v.id("prompts")),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pageSize = Math.min(args.limit ?? 20, 100);

    let jobsQuery;

    if (args.status) {
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else if (args.promptId) {
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_promptId", (q) => q.eq("promptId", args.promptId!));
    } else {
      jobsQuery = ctx.db.query("researchJobs");
    }

    const paginatedResult = await jobsQuery.order("desc").paginate({
      numItems: pageSize,
      cursor: args.cursor ?? null,
    });

    let results = paginatedResult.page;

    // Filter by stockId in memory (stockIds is an array field)
    if (args.stockId) {
      results = results.filter((j) => j.stockIds.includes(args.stockId!));
    }

    // Filter by date range
    if (args.dateFrom) {
      results = results.filter((j) => j.createdAt >= args.dateFrom!);
    }
    if (args.dateTo) {
      results = results.filter((j) => j.createdAt <= args.dateTo!);
    }

    return {
      results,
      cursor: paginatedResult.continueCursor,
      isDone: paginatedResult.isDone,
    };
  },
});

export const searchResults = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxResults = Math.min(args.limit ?? 50, 100);
    const term = args.searchTerm.toLowerCase();

    if (term.length === 0) {
      return [];
    }

    // Search through completed jobs that have results
    const completedJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .collect();

    const matches = [];
    for (const job of completedJobs) {
      if (matches.length >= maxResults) break;

      if (job.result && job.result.toLowerCase().includes(term)) {
        matches.push(job);
      } else if (job.promptSnapshot.toLowerCase().includes(term)) {
        matches.push(job);
      }
    }

    return matches;
  },
});

export const getJobByExternalId = internalQuery({
  args: { externalJobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("researchJobs")
      .withIndex("by_externalJobId", (q) =>
        q.eq("externalJobId", args.externalJobId),
      )
      .unique();
  },
});
