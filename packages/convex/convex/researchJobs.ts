import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./authHelpers";
import { validateSearchTerm, truncateResult } from "./validation";
import { logAuditEvent } from "./auditLog";
import {
  jobFieldsForModel,
  modelIdValidator,
  providerValidator,
  resolveMutationModelId,
  type ProviderName,
} from "./providers/constants";
import {
  asConcurrencyJobs,
  buildAllProviderConcurrencySnapshots,
  MAX_ACTIVE_JOBS_SCAN,
} from "./researchConcurrency";
import { buildSearchTextForJob } from "./researchJobSearchMetadata";

const jobStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("formatting"),
  v.literal("completed"),
  v.literal("failed")
);

/** Loads pending and running jobs for concurrency calculations. */
async function loadActiveJobsForConcurrency(ctx: QueryCtx) {
  const pendingJobs = await ctx.db
    .query("researchJobs")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .take(MAX_ACTIVE_JOBS_SCAN);
  const runningJobs = await ctx.db
    .query("researchJobs")
    .withIndex("by_status", (q) => q.eq("status", "running"))
    .take(MAX_ACTIVE_JOBS_SCAN);

  return [...pendingJobs, ...runningJobs];
}

/** Loads jobs in the post-research formatting pass (not counted toward provider concurrency). */
async function loadFormattingJobs(ctx: QueryCtx) {
  return await ctx.db
    .query("researchJobs")
    .withIndex("by_status", (q) => q.eq("status", "formatting"))
    .take(MAX_ACTIVE_JOBS_SCAN);
}

/**
 * Pending, running, and formatting jobs for UI "active" surfaces.
 * Concurrency snapshots still use {@link loadActiveJobsForConcurrency} only.
 */
async function loadDisplayActiveJobs(ctx: QueryCtx) {
  const [concurrencyJobs, formattingJobs] = await Promise.all([
    loadActiveJobsForConcurrency(ctx),
    loadFormattingJobs(ctx),
  ]);
  return [...concurrencyJobs, ...formattingJobs];
}

/**
 * Schedules dispatch for the oldest pending job when a provider slot opens.
 */
async function scheduleProviderQueueDrain(
  ctx: MutationCtx,
  provider: ProviderName
) {
  await ctx.scheduler.runAfter(0, internal.researchJobs.drainProviderQueue, {
    provider,
  });
}

// --- Mutations ---

export const createResearchJob = mutation({
  args: {
    promptId: v.id("prompts"),
    stockIds: v.array(v.id("stocks")),
    modelId: v.optional(modelIdValidator),
    provider: v.optional(providerValidator),
    scheduleId: v.optional(v.id("schedules")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    const resolvedModelId = resolveMutationModelId({
      modelId: args.modelId ?? prompt.defaultModelId,
      provider: args.provider ?? prompt.defaultProvider,
    });
    const { modelId, provider } = jobFieldsForModel(resolvedModelId);
    const now = Date.now();
    const { searchText } = await buildSearchTextForJob(ctx, {
      promptId: args.promptId,
      stockIds: args.stockIds,
    });
    return await ctx.db.insert("researchJobs", {
      promptId: args.promptId,
      promptSnapshot: prompt.template,
      stockIds: args.stockIds,
      modelId,
      provider,
      status: "pending",
      attempts: 0,
      scheduleId: args.scheduleId,
      createdAt: now,
      searchText,
    });
  },
});

export const createAndStartResearch = mutation({
  args: {
    promptId: v.id("prompts"),
    stockIds: v.array(v.id("stocks")),
    modelId: v.optional(modelIdValidator),
    provider: v.optional(providerValidator),
    scheduleId: v.optional(v.id("schedules")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    const resolvedModelId = resolveMutationModelId({
      modelId: args.modelId ?? prompt.defaultModelId,
      provider: args.provider ?? prompt.defaultProvider,
    });
    const { modelId, provider } = jobFieldsForModel(resolvedModelId);
    const now = Date.now();
    const { searchText } = await buildSearchTextForJob(ctx, {
      promptId: args.promptId,
      stockIds: args.stockIds,
    });
    const jobId = await ctx.db.insert("researchJobs", {
      promptId: args.promptId,
      promptSnapshot: prompt.template,
      stockIds: args.stockIds,
      modelId,
      provider,
      status: "pending",
      attempts: 0,
      scheduleId: args.scheduleId,
      createdAt: now,
      searchText,
    });

    await ctx.scheduler.runAfter(
      0,
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
    rawResult: v.optional(v.string()),
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
    if (updates.rawResult !== undefined)
      patch.rawResult = truncateResult(updates.rawResult);
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

    if (
      updates.status === "completed" ||
      updates.status === "failed" ||
      updates.status === "formatting"
    ) {
      await scheduleProviderQueueDrain(ctx, job.provider);
    }

    return id;
  },
});

/** Moves a job into the formatting phase after provider research finishes. */
export const beginFormattingPhase = internalMutation({
  args: {
    id: v.id("researchJobs"),
    rawResult: v.string(),
    costUsd: v.number(),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, {
      status: "formatting",
      rawResult: truncateResult(args.rawResult),
      costUsd: args.costUsd,
      durationMs: args.durationMs,
      externalJobId: undefined,
      formatExternalId: undefined,
      formatStartedAt: Date.now(),
      formatAttempts: 0,
    });

    await scheduleProviderQueueDrain(ctx, job.provider);
    return args.id;
  },
});

/** Resets format tracking for a backfill on an already-completed job. */
export const beginBackfillFormat = internalMutation({
  args: { id: v.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, {
      formatExternalId: undefined,
      formatStartedAt: Date.now(),
      formatAttempts: 0,
    });

    return args.id;
  },
});

/** Stores the OpenAI response id after submitting the format pass. */
export const setFormatExternalId = internalMutation({
  args: {
    id: v.id("researchJobs"),
    formatExternalId: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, { formatExternalId: args.formatExternalId });
    return args.id;
  },
});

/** Clears the external id so a new format response can be submitted (guard retry). */
export const clearFormatExternalId = internalMutation({
  args: { id: v.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, { formatExternalId: undefined });
    return args.id;
  },
});

export const incrementFormatAttempts = internalMutation({
  args: { id: v.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, {
      formatAttempts: (job.formatAttempts ?? 0) + 1,
    });
    return (job.formatAttempts ?? 0) + 1;
  },
});

const clearFormatTrackingFields = {
  formatExternalId: undefined,
  formatStartedAt: undefined,
  formatAttempts: undefined,
} as const;

/** Writes the polished report and marks the job completed. */
export const completeFormattedJob = internalMutation({
  args: {
    id: v.id("researchJobs"),
    result: v.string(),
    costUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    const result = truncateResult(args.result);
    const { searchText, title } = await buildSearchTextForJob(ctx, {
      promptId: job.promptId,
      stockIds: job.stockIds,
      resultMarkdown: result,
    });

    await ctx.db.patch(args.id, {
      status: "completed",
      result,
      title,
      searchText,
      costUsd: args.costUsd,
      completedAt: Date.now(),
      ...clearFormatTrackingFields,
    });

    await scheduleProviderQueueDrain(ctx, job.provider);
    return args.id;
  },
});

/** Updates a completed job after a backfill formatting pass. */
export const applyReformattedResult = internalMutation({
  args: {
    id: v.id("researchJobs"),
    rawResult: v.string(),
    result: v.string(),
    additionalCostUsd: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    const result = truncateResult(args.result);
    const { searchText, title } = await buildSearchTextForJob(ctx, {
      promptId: job.promptId,
      stockIds: job.stockIds,
      resultMarkdown: result,
    });

    await ctx.db.patch(args.id, {
      rawResult: truncateResult(args.rawResult),
      result,
      title,
      searchText,
      costUsd: (job.costUsd ?? 0) + args.additionalCostUsd,
      ...clearFormatTrackingFields,
    });

    return args.id;
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
    modelId: v.optional(v.string()),
    costUsd: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("costLogs", {
      jobId: args.jobId,
      provider: args.provider,
      modelId: args.modelId,
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

    if (
      job.status !== "pending" &&
      job.status !== "running" &&
      job.status !== "formatting"
    ) {
      throw new Error(`Cannot cancel job with status "${job.status}"`);
    }

    await ctx.db.patch(args.id, {
      status: "failed",
      error: "Cancelled by user",
      completedAt: Date.now(),
      externalJobId: undefined,
      formatExternalId: undefined,
      formatStartedAt: undefined,
      formatAttempts: undefined,
    });
    await scheduleProviderQueueDrain(ctx, job.provider);
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

    if (
      job.status === "pending" ||
      job.status === "running" ||
      job.status === "formatting"
    ) {
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

    const concurrencyJobs = await loadActiveJobsForConcurrency(ctx);
    const jobs = await loadDisplayActiveJobs(ctx);
    const byProvider = buildAllProviderConcurrencySnapshots(
      asConcurrencyJobs(concurrencyJobs)
    );

    return {
      jobs,
      byProvider,
      count: jobs.length,
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

/**
 * Latest completed research job that includes the given stock ticker (for backfill).
 */
export const findLatestCompletedJobByTicker = internalQuery({
  args: { ticker: v.string() },
  handler: async (ctx, args) => {
    const stock = await ctx.db
      .query("stocks")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker))
      .first();

    if (!stock) {
      return null;
    }

    const completedJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(100);

    const match = completedJobs.find((job) => job.stockIds.includes(stock._id));
    return match?._id ?? null;
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

    if (args.stockId) {
      results = results.filter((j) => j.stockIds.includes(args.stockId!));
    }

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
    const term = args.searchTerm.trim();

    if (term.length === 0) {
      return [];
    }

    const matches = await ctx.db
      .query("researchJobs")
      .withSearchIndex("search_metadata", (q) => q.search("searchText", term))
      .take(maxResults);

    return matches.sort((a, b) => b.createdAt - a.createdAt);
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
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(MAX_ACTIVE_JOBS_SCAN);

    return runningJobs.filter(
      (job) => job.externalJobId && job.createdAt < cutoff
    );
  },
});

/** Returns formatting jobs whose format pass started before the cutoff. */
export const getStaleFormattingJobs = internalQuery({
  args: { staleThresholdMs: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.staleThresholdMs;
    const formattingJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "formatting"))
      .take(MAX_ACTIVE_JOBS_SCAN);

    return formattingJobs.filter((job) => {
      if (job.rawResult === undefined) return false;
      const started = job.formatStartedAt ?? job.createdAt;
      return started < cutoff;
    });
  },
});

/** Active jobs used by dispatch logic in researchActions. */
export const getConcurrencyJobsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const activeJobs = await loadActiveJobsForConcurrency(ctx);
    return asConcurrencyJobs(activeJobs);
  },
});

/**
 * Starts the oldest pending job for a provider when a dispatch slot is available.
 */
export const drainProviderQueue = internalMutation({
  args: { provider: providerValidator },
  handler: async (ctx, args) => {
    const activeJobs = await loadActiveJobsForConcurrency(ctx);
    const snapshot = buildAllProviderConcurrencySnapshots(
      asConcurrencyJobs(activeJobs)
    )[args.provider];

    if (!snapshot.hasDispatchSlot) {
      return null;
    }

    const pendingJobs = activeJobs
      .filter(
        (job) => job.provider === args.provider && job.status === "pending"
      )
      .sort((left, right) => left.createdAt - right.createdAt);

    const nextJob = pendingJobs[0];
    if (!nextJob) {
      return null;
    }

    await ctx.scheduler.runAfter(0, internal.researchActions.startResearch, {
      jobId: nextJob._id,
    });

    return nextJob._id;
  },
});

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

/**
 * Ops: length distribution of completed research outputs (empirical sizing).
 * Used to validate whether multi-chunk formatting is needed.
 */
export const summarizeResearchResultSizes = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 200, 500);
    const jobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(limit);

    const lengths = jobs
      .map((j) => j.rawResult?.length ?? j.result?.length ?? 0)
      .filter((n) => n > 0)
      .toSorted((a, b) => a - b);

    const percentile = (p: number) => {
      if (lengths.length === 0) return 0;
      const idx = Math.min(
        lengths.length - 1,
        Math.floor((p / 100) * lengths.length)
      );
      return lengths[idx] ?? 0;
    };

    return {
      sampleCount: lengths.length,
      min: lengths[0] ?? 0,
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      max: lengths[lengths.length - 1] ?? 0,
    };
  },
});

/** Ops: compare raw vs formatted snippets for a job (e.g. verify backfill). */
export const debugJobFormatting = internalQuery({
  args: { jobId: v.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    const needles = ["Model mechanics", "Pricing power", "sold out of capacity"];
    const snippet = (text: string | undefined) => {
      if (!text) return null;
      for (const needle of needles) {
        const idx = text.indexOf(needle);
        if (idx >= 0) return text.slice(idx, idx + 1200);
      }
      return null;
    };

    const countH2 = (text: string | undefined) =>
      text?.match(/^## /gm)?.length ?? 0;
    const countH3 = (text: string | undefined) =>
      text?.match(/^### /gm)?.length ?? 0;
    const h2Titles =
      job.result?.match(/^## (.+)$/gm)?.map((line) => line.slice(3)) ?? [];

    return {
      status: job.status,
      rawLen: job.rawResult?.length ?? 0,
      resultLen: job.result?.length ?? 0,
      identical: job.rawResult === job.result,
      resultH2Count: countH2(job.result),
      resultH3Count: countH3(job.result),
      resultH2Titles: h2Titles.slice(0, 20),
      rawSnippet: snippet(job.rawResult),
      resultSnippet: snippet(job.result),
    };
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

/** Looks up a job by the OpenAI response id used for the formatting pass. */
export const getJobByFormatExternalId = internalQuery({
  args: { formatExternalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("researchJobs")
      .withIndex("by_formatExternalId", (q) =>
        q.eq("formatExternalId", args.formatExternalId)
      )
      .unique();
  },
});
