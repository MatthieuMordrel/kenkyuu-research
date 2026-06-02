import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./authHelpers";
import { validateScheduleInput, validateEarningsConfig } from "./validation";
import { logAuditEvent } from "./auditLog";
import {
  assertModelActive,
  jobFieldsForModel,
  modelIdValidator,
  providerValidator,
  resolveMutationModelId,
} from "./providers/constants";

const stockSelectionValidator = v.object({
  type: v.union(
    v.literal("all"),
    v.literal("tagged"),
    v.literal("specific"),
    v.literal("none")
  ),
  tags: v.optional(v.array(v.string())),
  stockIds: v.optional(v.array(v.id("stocks"))),
});

// --- Mutations ---

const earningsConfigValidator = v.object({
  offsetDays: v.number(),
  adjustForHour: v.boolean(),
  earningsMode: v.optional(
    v.union(
      v.literal("each"),
      v.literal("after_last"),
      v.literal("before_first")
    )
  ),
});

export const createSchedule = mutation({
  args: {
    name: v.string(),
    promptId: v.id("prompts"),
    stockSelection: stockSelectionValidator,
    modelId: v.optional(modelIdValidator),
    provider: v.optional(providerValidator),
    cron: v.optional(v.string()),
    timezone: v.optional(v.string()),
    enabled: v.boolean(),
    triggerType: v.optional(v.union(v.literal("cron"), v.literal("earnings"))),
    earningsConfig: v.optional(earningsConfigValidator),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    validateScheduleInput(args);

    const effectiveTriggerType = args.triggerType ?? "cron";

    // Validate trigger-specific fields
    if (effectiveTriggerType === "cron") {
      if (!args.cron) {
        throw new Error("Cron expression is required for time-based schedules");
      }
      if (!args.timezone) {
        throw new Error("Timezone is required for time-based schedules");
      }
    } else if (effectiveTriggerType === "earnings") {
      if (!args.earningsConfig) {
        throw new Error(
          "Earnings config is required for earnings-based schedules"
        );
      }
      validateEarningsConfig(args.earningsConfig);
      if (args.stockSelection.type === "none") {
        throw new Error(
          "Stock selection is required for earnings-based schedules"
        );
      }
    }

    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Validate prompt type vs stock selection and trigger type
    if (prompt.type === "discovery" && args.stockSelection.type !== "none") {
      throw new Error("Discovery prompts should use 'none' stock selection");
    }
    if (prompt.type !== "discovery" && args.stockSelection.type === "none") {
      throw new Error("This prompt type requires stock selection");
    }
    if (prompt.type === "discovery" && effectiveTriggerType === "earnings") {
      throw new Error(
        "Earnings triggers are not compatible with discovery prompts"
      );
    }

    // Validate stock selection
    if (
      args.stockSelection.type === "tagged" &&
      (!args.stockSelection.tags || args.stockSelection.tags.length === 0)
    ) {
      throw new Error(
        "Tags are required when stock selection type is 'tagged'"
      );
    }
    if (
      args.stockSelection.type === "specific" &&
      (!args.stockSelection.stockIds ||
        args.stockSelection.stockIds.length === 0)
    ) {
      throw new Error(
        "Stock IDs are required when stock selection type is 'specific'"
      );
    }

    const resolvedModelId = resolveMutationModelId({
      modelId: args.modelId,
      provider: args.provider ?? prompt.defaultProvider,
    });
    assertModelActive(resolvedModelId);
    const scheduleModel = jobFieldsForModel(resolvedModelId);

    const now = Date.now();
    const scheduleData: Record<string, unknown> = {
      name: args.name,
      promptId: args.promptId,
      stockSelection: args.stockSelection,
      modelId: scheduleModel.modelId,
      provider: scheduleModel.provider,
      enabled: args.enabled,
      createdAt: now,
    };

    // Timezone is only stored for cron schedules. Earnings schedules
    // derive timezone from each stock's exchange via getMarketTimezone().
    if (args.timezone) {
      scheduleData.timezone = args.timezone;
    }

    if (effectiveTriggerType === "earnings") {
      scheduleData.triggerType = "earnings";
      scheduleData.earningsConfig = args.earningsConfig;
    } else {
      scheduleData.triggerType = "cron";
      scheduleData.cron = args.cron;
    }

    const scheduleId = await ctx.db.insert("schedules", scheduleData as never);

    // Only cron schedules use self-rescheduling; earnings schedules are driven by the hourly cron
    if (args.enabled && effectiveTriggerType === "cron") {
      await ctx.scheduler.runAfter(
        0,
        internal.scheduleActions.scheduleNextRun,
        {
          scheduleId,
        }
      );
    }

    await logAuditEvent(ctx, {
      action: "schedule.create",
      resourceType: "schedules",
      resourceId: scheduleId,
      details: args.name,
    });
    return scheduleId;
  },
});

export const updateSchedule = mutation({
  args: {
    id: v.id("schedules"),
    name: v.optional(v.string()),
    promptId: v.optional(v.id("prompts")),
    stockSelection: v.optional(stockSelectionValidator),
    modelId: v.optional(modelIdValidator),
    provider: v.optional(providerValidator),
    cron: v.optional(v.string()),
    timezone: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    triggerType: v.optional(v.union(v.literal("cron"), v.literal("earnings"))),
    earningsConfig: v.optional(earningsConfigValidator),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    validateScheduleInput(args);

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    // Validate earnings config if provided
    if (args.earningsConfig) {
      validateEarningsConfig(args.earningsConfig);
    }

    const { id, token: _token, ...updates } = args;
    const patch: Record<string, unknown> = {};

    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.promptId !== undefined) {
      const prompt = await ctx.db.get(updates.promptId);
      if (!prompt) throw new Error("Prompt not found");
      patch.promptId = updates.promptId;
    }
    if (updates.stockSelection !== undefined)
      patch.stockSelection = updates.stockSelection;

    // Cross-validate prompt type vs stock selection and trigger type
    const effectivePromptId = updates.promptId ?? schedule.promptId;
    const effectiveStockSelection =
      updates.stockSelection ?? schedule.stockSelection;
    const effectiveTriggerType =
      updates.triggerType ?? schedule.triggerType ?? "cron";
    const effectivePrompt = await ctx.db.get(effectivePromptId);
    if (effectivePrompt) {
      if (
        effectivePrompt.type === "discovery" &&
        effectiveStockSelection.type !== "none"
      ) {
        throw new Error("Discovery prompts should use 'none' stock selection");
      }
      if (
        effectivePrompt.type !== "discovery" &&
        effectiveStockSelection.type === "none"
      ) {
        throw new Error("This prompt type requires stock selection");
      }
      if (
        effectivePrompt.type === "discovery" &&
        effectiveTriggerType === "earnings"
      ) {
        throw new Error(
          "Earnings triggers are not compatible with discovery prompts"
        );
      }
    }
    if (updates.modelId !== undefined || updates.provider !== undefined) {
      const resolvedModelId = resolveMutationModelId({
        modelId: updates.modelId ?? schedule.modelId,
        provider: updates.provider ?? schedule.provider,
      });
      assertModelActive(resolvedModelId);
      const fields = jobFieldsForModel(resolvedModelId);
      patch.modelId = fields.modelId;
      patch.provider = fields.provider;
    }
    if (updates.cron !== undefined) patch.cron = updates.cron;
    if (updates.timezone !== undefined) patch.timezone = updates.timezone;
    if (updates.enabled !== undefined) patch.enabled = updates.enabled;
    if (updates.triggerType !== undefined)
      patch.triggerType = updates.triggerType;
    if (updates.earningsConfig !== undefined)
      patch.earningsConfig = updates.earningsConfig;

    // Clear timezone when switching to earnings (timezone is per-stock via exchange)
    if (updates.triggerType === "earnings" && schedule.timezone) {
      patch.timezone = undefined;
    }

    await ctx.db.patch(id, patch);

    const oldTriggerType = schedule.triggerType ?? "cron";
    const newTriggerType = updates.triggerType ?? oldTriggerType;
    const wasEnabled = schedule.enabled;
    const isNowEnabled = updates.enabled ?? schedule.enabled;
    const cronChanged =
      updates.cron !== undefined && updates.cron !== schedule.cron;
    const timezoneChanged =
      updates.timezone !== undefined && updates.timezone !== schedule.timezone;
    const switchedToCron =
      oldTriggerType === "earnings" && newTriggerType === "cron";
    const switchedToEarnings =
      oldTriggerType === "cron" && newTriggerType === "earnings";

    // If switching to earnings, cancel any pending cron scheduled function
    if (switchedToEarnings && schedule.nextScheduledFunctionId) {
      try {
        await ctx.scheduler.cancel(schedule.nextScheduledFunctionId as never);
      } catch {
        // May already have executed or been cancelled
      }
      await ctx.db.patch(id, {
        nextRunAt: undefined,
        nextScheduledFunctionId: undefined,
      });
    }

    // Only manage self-rescheduling for cron-type schedules
    if (newTriggerType === "cron") {
      if (
        isNowEnabled &&
        (!wasEnabled || cronChanged || timezoneChanged || switchedToCron)
      ) {
        if (schedule.nextScheduledFunctionId) {
          try {
            await ctx.scheduler.cancel(
              schedule.nextScheduledFunctionId as never
            );
          } catch {
            // May already have executed or been cancelled
          }
        }
        await ctx.scheduler.runAfter(
          0,
          internal.scheduleActions.scheduleNextRun,
          {
            scheduleId: id,
          }
        );
      } else if (!isNowEnabled && wasEnabled) {
        if (schedule.nextScheduledFunctionId) {
          try {
            await ctx.scheduler.cancel(
              schedule.nextScheduledFunctionId as never
            );
          } catch {
            // May already have executed or been cancelled
          }
        }
        await ctx.db.patch(id, {
          nextRunAt: undefined,
          nextScheduledFunctionId: undefined,
        });
      }
    }

    return id;
  },
});

export const runScheduleNow = mutation({
  args: {
    id: v.id("schedules"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const schedule = await ctx.db.get(args.id);
    if (!schedule) throw new Error("Schedule not found");

    await ctx.scheduler.runAfter(0, internal.scheduleActions.executeRunNow, {
      scheduleId: args.id,
    });

    await logAuditEvent(ctx, {
      action: "schedule.runNow",
      resourceType: "schedules",
      resourceId: args.id,
      details: schedule.name,
    });

    return args.id;
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
    await logAuditEvent(ctx, {
      action: "schedule.delete",
      resourceType: "schedules",
      resourceId: args.id,
      details: schedule.name,
    });
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

    const isCronType = (schedule.triggerType ?? "cron") === "cron";

    if (isCronType) {
      if (newEnabled && !isGloballyPaused) {
        await ctx.scheduler.runAfter(
          0,
          internal.scheduleActions.scheduleNextRun,
          {
            scheduleId: args.id,
          }
        );
      } else if (!newEnabled) {
        if (schedule.nextScheduledFunctionId) {
          try {
            await ctx.scheduler.cancel(
              schedule.nextScheduledFunctionId as never
            );
          } catch {
            // May already have executed or been cancelled
          }
        }
        await ctx.db.patch(args.id, {
          nextRunAt: undefined,
          nextScheduledFunctionId: undefined,
        });
      }
    }
    // Earnings-type schedules: just toggling enabled is enough; the hourly cron checks enabled status

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
      // Pausing: cancel all enabled cron-type scheduled functions
      const enabledSchedules = await ctx.db
        .query("schedules")
        .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true))
        .take(200);
      for (const schedule of enabledSchedules) {
        if (schedule.nextScheduledFunctionId) {
          try {
            await ctx.scheduler.cancel(
              schedule.nextScheduledFunctionId as never
            );
          } catch {
            // Already executed or cancelled
          }
          await ctx.db.patch(schedule._id, {
            nextRunAt: undefined,
            nextScheduledFunctionId: undefined,
          });
        }
      }
      // Earnings-type schedules: hourly cron checks global pause status, no action needed
    } else {
      // Unpausing: reschedule all enabled cron-type schedules
      const enabledSchedules = await ctx.db
        .query("schedules")
        .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true))
        .take(200);
      for (const schedule of enabledSchedules) {
        const isCronType = (schedule.triggerType ?? "cron") === "cron";
        if (isCronType) {
          await ctx.scheduler.runAfter(
            0,
            internal.scheduleActions.scheduleNextRun,
            {
              scheduleId: schedule._id,
            }
          );
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
    if (args.nextScheduledFunctionId !== undefined)
      patch.nextScheduledFunctionId = args.nextScheduledFunctionId;
    if (args.lastRunAt !== undefined) patch.lastRunAt = args.lastRunAt;

    await ctx.db.patch(args.id, patch);
  },
});

// --- Queries ---

export const listSchedules = query({
  args: {
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 200, 200);
    const schedules = await ctx.db
      .query("schedules")
      .order("desc")
      .take(maxResults);

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

    // Use compound index to get only enabled schedules sorted by nextRunAt
    const enabledSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true))
      .order("asc")
      .take(maxResults);

    const upcoming = enabledSchedules
      .filter((s) => s.nextRunAt !== undefined)
      .map((s) => ({
        scheduleId: s._id,
        scheduleName: s.name,
        promptId: s.promptId,
        nextRunAt: s.nextRunAt!,
        timezone: s.timezone ?? "UTC",
      }));

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
    modelId: v.optional(v.string()),
    provider: providerValidator,
    scheduleId: v.id("schedules"),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.promptId);
    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Enforce concurrent job limit on scheduled jobs to prevent bypass
    const MAX_CONCURRENT_JOBS = 3;
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
        `Maximum of ${MAX_CONCURRENT_JOBS} concurrent jobs allowed. Scheduled job deferred.`
      );
    }

    const now = Date.now();
    const resolvedModelId = resolveMutationModelId({
      modelId: args.modelId,
      provider: args.provider,
    });
    const { modelId, provider } = jobFieldsForModel(resolvedModelId);
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
    });

    // Stagger start to avoid hitting OpenAI rate limits
    const staggerDelayMs = runningJobs.length * 10_000; // 10s per running job
    await ctx.scheduler.runAfter(
      staggerDelayMs,
      internal.researchActions.startResearch,
      {
        jobId,
      }
    );

    return jobId;
  },
});

export const listStocksInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stocks").collect();
  },
});
