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
  }),

  researchJobs: defineTable({
    promptId: v.id("prompts"),
    promptSnapshot: v.string(),
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
  })
    .index("by_status", ["status"])
    .index("by_promptId", ["promptId"])
    .index("by_scheduleId", ["scheduleId"])
    .index("by_externalJobId", ["externalJobId"]),

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
    cron: v.string(),
    timezone: v.string(),
    enabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    nextScheduledFunctionId: v.optional(v.string()),
    createdAt: v.number(),
  }),

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

  sessions: defineTable({
    token: v.string(),
    expiresAt: v.number(),
    rememberMe: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_expiresAt", ["expiresAt"]),
});
