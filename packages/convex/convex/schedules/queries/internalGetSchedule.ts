import { internalQuery } from "../../_generated/server";
import { vv } from "../../schema";

/** Get a schedule by id (internal, no auth). */
export const internalGetSchedule = internalQuery({
  args: { id: vv.id("schedules") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
