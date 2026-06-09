import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { mutation } from "../../_generated/server";
import { logAuditEvent } from "../../auditLog";
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

/** Create a new research schedule (cron- or earnings-triggered). */
export const createSchedule = mutation({
  args: {
    name: v.string(),
    promptId: vv.id("prompts"),
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
        internal.schedules.actions.internalScheduleNextRun
          .internalScheduleNextRun,
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
