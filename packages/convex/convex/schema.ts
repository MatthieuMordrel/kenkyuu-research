import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  stocks: defineTable({
    ticker: v.string(),
    exchange: v.string(),
    companyName: v.string(),
    sector: v.optional(v.string()),
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ticker", ["ticker"])
    .index("by_tags", ["tags"]),

  prompts: defineTable({
    name: v.string(),
    description: v.string(),
    type: v.union(
      v.literal("single-stock"),
      v.literal("multi-stock"),
      v.literal("discovery"),
    ),
    template: v.string(),
    defaultProvider: v.literal("openai"),
    isBuiltIn: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_name", ["name"]),

  researchJobs: defineTable({
    promptId: v.id("prompts"),
    promptSnapshot: v.string(),
    resolvedPrompt: v.optional(v.string()),
    stockIds: v.array(v.id("stocks")),
    provider: v.literal("openai"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    externalJobId: v.optional(v.string()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    costUsd: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    attempts: v.number(),
    scheduleId: v.optional(v.id("schedules")),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    isFavorited: v.optional(v.boolean()),
  })
    .index("by_status", ["status"])
    .index("by_promptId", ["promptId"])
    .index("by_scheduleId", ["scheduleId"])
    .index("by_externalJobId", ["externalJobId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_isFavorited", ["isFavorited"]),

  schedules: defineTable({
    name: v.string(),
    promptId: v.id("prompts"),
    stockSelection: v.object({
      type: v.union(
        v.literal("all"),
        v.literal("tagged"),
        v.literal("specific"),
        v.literal("none"),
      ),
      tags: v.optional(v.array(v.string())),
      stockIds: v.optional(v.array(v.id("stocks"))),
    }),
    provider: v.literal("openai"),
    timezone: v.string(),
    enabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
    createdAt: v.number(),

    // Trigger type: "cron" (default/legacy) or "earnings"
    triggerType: v.optional(
      v.union(v.literal("cron"), v.literal("earnings")),
    ),

    // Cron-specific fields (used when triggerType is "cron" or missing)
    cron: v.optional(v.string()),
    nextRunAt: v.optional(v.number()),
    nextScheduledFunctionId: v.optional(v.string()),

    // Earnings-specific fields (used when triggerType is "earnings")
    earningsConfig: v.optional(
      v.object({
        offsetDays: v.number(), // -7 to +14. 0 = earnings day, 1 = day after, -1 = day before
        runTimeUTC: v.string(), // "HH:MM" format
        adjustForHour: v.boolean(), // if true, amc earnings at offset=0 delay to next morning
      }),
    ),
  })
    .index("by_enabled_nextRunAt", ["enabled", "nextRunAt"]),

  earningsTriggeredRuns: defineTable({
    scheduleId: v.id("schedules"),
    earningsId: v.id("earnings"),
    stockId: v.id("stocks"),
    earningsDate: v.string(), // YYYY-MM-DD
    triggeredAt: v.number(),
    jobId: v.optional(v.id("researchJobs")),
  })
    .index("by_schedule_earnings", ["scheduleId", "earningsId"])
    .index("by_schedule_date", ["scheduleId", "earningsDate"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  costLogs: defineTable({
    jobId: v.id("researchJobs"),
    provider: v.literal("openai"),
    costUsd: v.number(),
    timestamp: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_timestamp", ["timestamp"]),

  earnings: defineTable({
    stockId: v.id("stocks"),
    symbol: v.string(),
    date: v.string(), // YYYY-MM-DD
    epsEstimate: v.optional(v.number()),
    epsActual: v.optional(v.number()),
    revenueEstimate: v.optional(v.number()),
    revenueActual: v.optional(v.number()),
    hour: v.optional(v.string()), // bmo, amc, dmh
    quarter: v.optional(v.number()),
    year: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_stockId", ["stockId"])
    .index("by_symbol_date", ["symbol", "date"])
    .index("by_date", ["date"]),

  sessions: defineTable({
    token: v.string(),
    expiresAt: v.number(),
    rememberMe: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_expiresAt", ["expiresAt"]),

  loginAttempts: defineTable({
    identifier: v.string(), // "global" for single-user setup
    timestamp: v.number(),
    success: v.boolean(),
  })
    .index("by_identifier_timestamp", ["identifier", "timestamp"]),

  auditLogs: defineTable({
    action: v.string(), // e.g. "stock.create", "prompt.delete", "settings.update"
    resourceType: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    details: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_action", ["action"]),
});
