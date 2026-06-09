import { v } from "convex/values";
import { query } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Returns a single research job by id for an authenticated caller. */
export const getJob = query({
  args: { id: vv.id("researchJobs"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.get(args.id);
  },
});
