import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./authHelpers";
import { validateSearchTerm, truncateResult } from "./validation";
import { logAuditEvent } from "./auditLog";
import { providerValidator } from "./providers/constants";

const MAX_CONCURRENT_JOBS = 3;

const jobStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed")
);

/** Throws if concurrent job limit is reached. */
async function enforceConcurrentJobLimit(ctx: MutationCtx) {
  const pendingJobs = await ctx.db
    .query("researchJobs")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .take(MAX_CONCURRENT_JOBS);
  const runningJobs = await ctx.db
    .query("researchJobs")
    .withIndex("by_status", (q) => q.eq("status", "running"))
    .take(MAX_CONCURRENT_JOBS);

  if (pendingJobs.length + runningJobs.length >= MAX_CONCURRENT_JOBS) {
    throw new Error(
      `Maximum of ${MAX_CONCURRENT_JOBS} concurrent jobs allowed`
    );
  }
}

// --- Mutations ---

export const createResearchJob = mutation({
  args: {
    promptId: v.id("prompts"),
    stockIds: v.array(v.id("stocks")),
    provider: providerValidator,
    scheduleId: v.optional(v.id("schedules")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    await enforceConcurrentJobLimit(ctx);

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
    provider: providerValidator,
    scheduleId: v.optional(v.id("schedules")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    await enforceConcurrentJobLimit(ctx);

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

    // Stagger job starts to avoid hitting OpenAI rate limits.
    // If other jobs are already running/pending, add a 10s delay per job.
    const currentRunning = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(MAX_CONCURRENT_JOBS);
    const staggerDelayMs = currentRunning.length * 10_000; // 10s per running job

    await ctx.scheduler.runAfter(
      staggerDelayMs,
      internal.researchActions.startResearch,
      { jobId }
    );

    return jobId;
  },
});

export const updateJobStatus = internalMutation({
  args: {
    id: v.id("researchJobs"),
    status: jobStatus,
    externalJobId: v.optional(v.string()),
    resolvedPrompt: v.optional(v.string()),
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
    if (updates.resolvedPrompt !== undefined)
      patch.resolvedPrompt = updates.resolvedPrompt;
    if (updates.result !== undefined)
      patch.result = truncateResult(updates.result);
    if (updates.error !== undefined) patch.error = updates.error;
    if (updates.costUsd !== undefined) patch.costUsd = updates.costUsd;
    if (updates.durationMs !== undefined) patch.durationMs = updates.durationMs;

    if (updates.status === "completed" || updates.status === "failed") {
      patch.completedAt = Date.now();
    }

    // Clear error and completedAt when a retry moves the job back to running
    if (updates.status === "running") {
      patch.error = undefined;
      patch.completedAt = undefined;
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
    provider: providerValidator,
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
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

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
    await logAuditEvent(ctx, {
      action: "job.cancel",
      resourceType: "researchJobs",
      resourceId: args.id,
    });

    return args.id;
  },
});

export const retryJob = mutation({
  args: {
    id: v.id("researchJobs"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    if (job.status !== "failed") {
      throw new Error("Can only retry failed jobs");
    }

    // Enforce concurrent job limit on retry to prevent bypass
    await enforceConcurrentJobLimit(ctx);

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

    await ctx.scheduler.runAfter(0, internal.researchActions.startResearch, {
      jobId: args.id,
    });

    return args.id;
  },
});

export const deleteJob = mutation({
  args: {
    id: v.id("researchJobs"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    if (job.status === "pending" || job.status === "running") {
      throw new Error(`Cannot delete a ${job.status} job. Cancel it first.`);
    }

    // Delete associated cost logs
    const costLogs = await ctx.db
      .query("costLogs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.id))
      .collect();

    for (const log of costLogs) {
      await ctx.db.delete(log._id);
    }

    // Delete the job itself
    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, {
      action: "job.delete",
      resourceType: "researchJobs",
      resourceId: args.id,
    });

    return args.id;
  },
});

export const toggleFavorite = mutation({
  args: {
    id: v.id("researchJobs"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    const newValue = !job.isFavorited;
    await ctx.db.patch(args.id, { isFavorited: newValue });
    return { id: args.id, isFavorited: newValue };
  },
});

// --- Queries ---

export const listJobs = query({
  args: {
    status: v.optional(jobStatus),
    stockId: v.optional(v.id("stocks")),
    promptId: v.optional(v.id("prompts")),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 200, 500);
    let jobs;

    if (args.status) {
      jobs = await ctx.db
        .query("researchJobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(maxResults);
    } else if (args.promptId) {
      jobs = await ctx.db
        .query("researchJobs")
        .withIndex("by_promptId", (q) => q.eq("promptId", args.promptId!))
        .order("desc")
        .take(maxResults);
    } else {
      jobs = await ctx.db
        .query("researchJobs")
        .withIndex("by_createdAt")
        .order("desc")
        .take(maxResults);
    }

    // Filter by stockId in memory (stockIds is an array)
    if (args.stockId) {
      jobs = jobs.filter((j) => j.stockIds.includes(args.stockId!));
    }

    return jobs;
  },
});

export const getJob = query({
  args: { id: v.id("researchJobs"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.get(args.id);
  },
});

export const getActiveJobs = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const pendingJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(MAX_CONCURRENT_JOBS);
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(MAX_CONCURRENT_JOBS);

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
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

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
    } else if (args.dateFrom && args.dateTo) {
      // Use createdAt index for date-range filtering to avoid post-filter pagination issues
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_createdAt", (q) =>
          q.gte("createdAt", args.dateFrom!).lte("createdAt", args.dateTo!)
        );
    } else if (args.dateFrom) {
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_createdAt", (q) => q.gte("createdAt", args.dateFrom!));
    } else if (args.dateTo) {
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_createdAt", (q) => q.lte("createdAt", args.dateTo!));
    } else {
      jobsQuery = ctx.db.query("researchJobs");
    }

    const paginatedResult = await jobsQuery.order("desc").paginate({
      numItems: pageSize,
      cursor: args.cursor ?? null,
    });

    let results = paginatedResult.page;

    // Filter by stockId in memory (stockIds is an array field — can't index)
    if (args.stockId) {
      results = results.filter((j) => j.stockIds.includes(args.stockId!));
    }

    // Filter by date range in memory only when another index was chosen above
    if ((args.status || args.promptId) && args.dateFrom) {
      results = results.filter((j) => j.createdAt >= args.dateFrom!);
    }
    if ((args.status || args.promptId) && args.dateTo) {
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
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    validateSearchTerm(args.searchTerm);
    const maxResults = Math.min(args.limit ?? 50, 100);
    const term = args.searchTerm.toLowerCase();

    if (term.length === 0) {
      return [];
    }

    // Search through recent completed jobs that have results
    // Limit scan to avoid reading entire table for text search
    const scanLimit = maxResults * 10;
    const completedJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(scanLimit);

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

export const listFavorites = query({
  args: {
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 100, 200);
    return await ctx.db
      .query("researchJobs")
      .withIndex("by_isFavorited", (q) => q.eq("isFavorited", true))
      .order("desc")
      .take(maxResults);
  },
});

/** Returns running jobs that have been running for longer than the given threshold. */
export const getStaleRunningJobs = internalQuery({
  args: { staleThresholdMs: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.staleThresholdMs;
    // Running jobs are bounded by MAX_CONCURRENT_JOBS, but use a safe limit
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(50);

    return runningJobs.filter(
      (job) => job.externalJobId && job.createdAt < cutoff
    );
  },
});

/** Returns the count of jobs currently in "running" status (with an external ID = submitted to OpenAI). */
export const getRunningJobCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(10);
    // Only count jobs that have actually been submitted to OpenAI
    return runningJobs.filter((j) => j.externalJobId).length;
  },
});

export const getJobByExternalId = internalQuery({
  args: { externalJobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("researchJobs")
      .withIndex("by_externalJobId", (q) =>
        q.eq("externalJobId", args.externalJobId)
      )
      .unique();
  },
});
