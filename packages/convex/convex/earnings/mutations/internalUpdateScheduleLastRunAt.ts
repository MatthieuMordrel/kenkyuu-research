import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";

/** Stamp a schedule's lastRunAt with the current time. */
export const internalUpdateScheduleLastRunAt = internalMutation({
  args: { id: vv.id("schedules") },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id);
    if (!schedule) return;
    await ctx.db.patch(args.id, { lastRunAt: Date.now() });
  },
});
