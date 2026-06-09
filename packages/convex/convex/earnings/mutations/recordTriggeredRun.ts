import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";

/** Record that a schedule triggered a run for an earnings entry (dedup bookkeeping). */
export const recordTriggeredRun = internalMutation({
  args: {
    scheduleId: vv.id("schedules"),
    earningsId: vv.id("earnings"),
    stockId: vv.id("stocks"),
    earningsDate: v.string(),
    jobId: v.optional(vv.id("researchJobs")),
    quarterKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("earningsTriggeredRuns", {
      scheduleId: args.scheduleId,
      earningsId: args.earningsId,
      stockId: args.stockId,
      earningsDate: args.earningsDate,
      triggeredAt: Date.now(),
      jobId: args.jobId,
      quarterKey: args.quarterKey,
    });
  },
});
