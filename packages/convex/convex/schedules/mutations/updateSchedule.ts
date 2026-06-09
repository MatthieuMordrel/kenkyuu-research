import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { mutation } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import {
  assertModelActive,
  jobFieldsForModel,
  modelIdValidator,
  providerValidator,
  resolveMutationModelId,
} from "../../providers/constants";
import { vv } from "../../schema";
import {
  validateEarningsConfig,
  validateScheduleInput,
} from "../../validation";
import { earningsConfigValidator } from "../shared/earningsConfigValidator";
import { stockSelectionValidator } from "../shared/stockSelectionValidator";

/** Update an existing schedule and reconcile its self-rescheduling state. */
export const updateSchedule = mutation({
  args: {
    id: vv.id("schedules"),
    name: v.optional(v.string()),
    promptId: v.optional(vv.id("prompts")),
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
          internal.schedules.actions.scheduleNextRun.scheduleNextRun,
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
