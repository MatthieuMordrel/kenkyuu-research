import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// --- Internal Queries ---

export const getEarningsSchedules = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allSchedules = await ctx.db
      .query("schedules")
      .withIndex("by_enabled_nextRunAt", (q) => q.eq("enabled", true))
      .take(200);

    return allSchedules.filter(
      (s) => s.triggerType === "earnings" && s.earningsConfig,
    );
  },
});

export const getEarningsByDate = internalQuery({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("earnings")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

export const checkAlreadyTriggered = internalQuery({
  args: {
    scheduleId: v.id("schedules"),
    earningsId: v.id("earnings"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("earningsTriggeredRuns")
      .withIndex("by_schedule_earnings", (q) =>
        q.eq("scheduleId", args.scheduleId).eq("earningsId", args.earningsId),
      )
      .first();
    return existing !== null;
  },
});

// --- Internal Mutations ---

export const recordTriggeredRun = internalMutation({
  args: {
    scheduleId: v.id("schedules"),
    earningsId: v.id("earnings"),
    stockId: v.id("stocks"),
    earningsDate: v.string(),
    jobId: v.optional(v.id("researchJobs")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("earningsTriggeredRuns", {
      scheduleId: args.scheduleId,
      earningsId: args.earningsId,
      stockId: args.stockId,
      earningsDate: args.earningsDate,
      triggeredAt: Date.now(),
      jobId: args.jobId,
    });
  },
});

export const updateScheduleLastRunAt = internalMutation({
  args: { id: v.id("schedules") },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id);
    if (!schedule) return;
    await ctx.db.patch(args.id, { lastRunAt: Date.now() });
  },
});
