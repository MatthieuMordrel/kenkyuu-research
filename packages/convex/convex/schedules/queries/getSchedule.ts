import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { vv } from "../../schema";

/** Get a single schedule by id. */
export const getSchedule = query({
  args: { id: vv.id("schedules"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.get(args.id);
  },
});
