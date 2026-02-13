import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./authHelpers";

const stockSelectionValidator = v.object({
  type: v.union(
    v.literal("all"),
    v.literal("tagged"),
    v.literal("specific"),
    v.literal("none"),
  ),
  tags: v.optional(v.array(v.string())),
  stockIds: v.optional(v.array(v.id("stocks"))),
});

// --- Mutations ---

export const createSchedule = mutation({
  args: {
    name: v.string(),
    promptId: v.id("prompts"),
    stockSelection: stockSelectionValidator,
    provider: v.literal("openai"),
    cron: v.string(),
    timezone: v.string(),
    enabled: v.boolean(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Validate stock selection
    if (args.stockSelection.type === "tagged" && (!args.stockSelection.tags || args.stockSelection.tags.length === 0)) {
      throw new Error("Tags are required when stock selection type is 'tagged'");
    }
    if (args.stockSelection.type === "specific" && (!args.stockSelection.stockIds || args.stockSelection.stockIds.length === 0)) {
      throw new Error("Stock IDs are required when stock selection type is 'specific'");
    }

    const now = Date.now();
    const scheduleId = await ctx.db.insert("schedules", {
      name: args.name,
      promptId: args.promptId,
      stockSelection: args.stockSelection,
      provider: args.provider,
      cron: args.cron,
      timezone: args.timezone,
      enabled: args.enabled,
      createdAt: now,
    });

    // If enabled, compute nextRunAt and schedule the first run
    if (args.enabled) {
      await ctx.scheduler.runAfter(0, internal.scheduleActions.scheduleNextRun, {
        scheduleId,
      });
    }

    return scheduleId;
  },
});

export const updateSchedule = mutation({
  args: {
    id: v.id("schedules"),
    name: v.optional(v.string()),
    promptId: v.optional(v.id("prompts")),
    stockSelection: v.optional(stockSelectionValidator),
    provider: v.optional(v.literal("openai")),
    cron: v.optional(v.string()),
    timezone: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    const { id, token: _token, ...updates } = args;
    const patch: Record<string, unknown> = {};

    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.promptId !== undefined) {
      const prompt = await ctx.db.get(updates.promptId);
      if (!prompt) throw new Error("Prompt not found");
      patch.promptId = updates.promptId;
    }
    if (updates.stockSelection !== undefined) patch.stockSelection = updates.stockSelection;
    if (updates.provider !== undefined) patch.provider = updates.provider;
    if (updates.cron !== undefined) patch.cron = updates.cron;
    if (updates.timezone !== undefined) patch.timezone = updates.timezone;
    if (updates.enabled !== undefined) patch.enabled = updates.enabled;

    await ctx.db.patch(id, patch);

    // If schedule config changed or was re-enabled, reschedule
    const wasEnabled = schedule.enabled;
    const isNowEnabled = updates.enabled ?? schedule.enabled;
    const cronChanged = updates.cron !== undefined && updates.cron !== schedule.cron;
    const timezoneChanged = updates.timezone !== undefined && updates.timezone !== schedule.timezone;

    if (isNowEnabled && (!wasEnabled || cronChanged || timezoneChanged)) {
      // Cancel existing scheduled function if any
      if (schedule.nextScheduledFunctionId) {
        try {
          await ctx.scheduler.cancel(schedule.nextScheduledFunctionId as never);
        } catch {
          // May already have executed or been cancelled
        }
      }
      await ctx.scheduler.runAfter(0, internal.scheduleActions.scheduleNextRun, {
        scheduleId: id,
      });
    } else if (!isNowEnabled && wasEnabled) {
      // Cancel existing scheduled function
      if (schedule.nextScheduledFunctionId) {
        try {
          await ctx.scheduler.cancel(schedule.nextScheduledFunctionId as never);
        } catch {
          // May already have executed or been cancelled
        }
      }
      await ctx.db.patch(id, { nextRunAt: undefined, nextScheduledFunctionId: undefined });
    }

    return id;
  },
});

export const deleteSchedule = mutation({
  args: {
    id: v.id("schedules"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    // Cancel any pending scheduled function
    if (schedule.nextScheduledFunctionId) {
      try {
        await ctx.scheduler.cancel(schedule.nextScheduledFunctionId as never);
      } catch {
        // May already have executed or been cancelled
      }
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const toggleSchedule = mutation({
  args: {
    id: v.id("schedules"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    const newEnabled = !schedule.enabled;
    await ctx.db.patch(args.id, { enabled: newEnabled });

    // Check global pause
    const globalPause = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();
    const isGloballyPaused = globalPause?.value === "true";

    if (newEnabled && !isGloballyPaused) {
      await ctx.scheduler.runAfter(0, internal.scheduleActions.scheduleNextRun, {
        scheduleId: args.id,
      });
    } else if (!newEnabled) {
      if (schedule.nextScheduledFunctionId) {
        try {
          await ctx.scheduler.cancel(schedule.nextScheduledFunctionId as never);
        } catch {
          // May already have executed or been cancelled
        }
      }
      await ctx.db.patch(args.id, { nextRunAt: undefined, nextScheduledFunctionId: undefined });
    }

    return { id: args.id, enabled: newEnabled };
  },
});

export const toggleGlobalPause = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();

    const currentlyPaused = existing?.value === "true";
    const newValue = !currentlyPaused;

    if (existing) {
      await ctx.db.patch(existing._id, { value: String(newValue) });
    } else {
      await ctx.db.insert("settings", {
        key: "global_schedules_paused",
        value: String(newValue),
      });
    }

    if (newValue) {
      // Pausing: cancel all scheduled functions
      const enabledSchedules = await ctx.db.query("schedules").collect();
      for (const schedule of enabledSchedules) {
        if (schedule.enabled && schedule.nextScheduledFunctionId) {
          try {
            await ctx.scheduler.cancel(schedule.nextScheduledFunctionId as never);
          } catch {
            // Already executed or cancelled
          }
          await ctx.db.patch(schedule._id, {
            nextRunAt: undefined,
            nextScheduledFunctionId: undefined,
          });
        }
      }
    } else {
      // Unpausing: reschedule all enabled schedules
      const enabledSchedules = await ctx.db.query("schedules").collect();
      for (const schedule of enabledSchedules) {
        if (schedule.enabled) {
          await ctx.scheduler.runAfter(0, internal.scheduleActions.scheduleNextRun, {
            scheduleId: schedule._id,
          });
        }
      }
    }

    return { paused: newValue };
  },
});

// --- Internal mutations (used by schedule actions) ---

export const updateScheduleNextRun = internalMutation({
  args: {
    id: v.id("schedules"),
    nextRunAt: v.optional(v.number()),
    nextScheduledFunctionId: v.optional(v.string()),
    lastRunAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id);
    if (!schedule) return;

    const patch: Record<string, unknown> = {};
    if (args.nextRunAt !== undefined) patch.nextRunAt = args.nextRunAt;
    if (args.nextScheduledFunctionId !== undefined) patch.nextScheduledFunctionId = args.nextScheduledFunctionId;
    if (args.lastRunAt !== undefined) patch.lastRunAt = args.lastRunAt;

    await ctx.db.patch(args.id, patch);
  },
});

// --- Queries ---

export const listSchedules = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const schedules = await ctx.db.query("schedules").order("desc").collect();

    const globalPause = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();

    return {
      schedules,
      globalPaused: globalPause?.value === "true",
    };
  },
});

export const getSchedule = query({
  args: { id: v.id("schedules"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.get(args.id);
  },
});

export const getScheduleInternal = internalQuery({
  args: { id: v.id("schedules") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getUpcomingRuns = query({
  args: {
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = args.limit ?? 10;

    const schedules = await ctx.db.query("schedules").collect();
    const upcoming = schedules
      .filter((s) => s.enabled && s.nextRunAt !== undefined)
      .map((s) => ({
        scheduleId: s._id,
        scheduleName: s.name,
        promptId: s.promptId,
        nextRunAt: s.nextRunAt!,
        timezone: s.timezone,
      }))
      .toSorted((a, b) => a.nextRunAt - b.nextRunAt)
      .slice(0, maxResults);

    return upcoming;
  },
});

export const getScheduleHistory = query({
  args: {
    scheduleId: v.id("schedules"),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 20, 100);

    const jobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_scheduleId", (q) => q.eq("scheduleId", args.scheduleId))
      .order("desc")
      .take(maxResults);

    return jobs;
  },
});

export const getGlobalPauseStatus = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();
    return setting?.value === "true";
  },
});

export const getGlobalPauseStatusInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global_schedules_paused"))
      .unique();
    return setting?.value === "true";
  },
});

// --- Internal helpers (called from scheduleActions) ---

export const createScheduledJob = internalMutation({
  args: {
    promptId: v.id("prompts"),
    stockIds: v.array(v.id("stocks")),
    provider: v.literal("openai"),
    scheduleId: v.id("schedules"),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Enforce concurrent job limit on scheduled jobs to prevent bypass
    const pendingJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    if (pendingJobs.length + runningJobs.length >= 5) {
      throw new Error("Maximum of 5 concurrent jobs allowed. Scheduled job deferred.");
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

    // Schedule the research action to start immediately
    await ctx.scheduler.runAfter(0, internal.researchActions.startResearch, {
      jobId,
    });

    return jobId;
  },
});

export const listStocksInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stocks").collect();
  },
});
