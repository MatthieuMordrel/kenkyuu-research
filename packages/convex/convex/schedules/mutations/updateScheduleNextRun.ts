import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";

/** Update a schedule's nextRunAt / scheduled function id / lastRunAt (used by schedule actions). */
export const updateScheduleNextRun = internalMutation({
  args: {
    id: vv.id("schedules"),
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
