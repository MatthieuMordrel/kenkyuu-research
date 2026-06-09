import { v } from "convex/values";
import { query } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { jobStatus } from "../shared/jobStatus";

/** Lists research jobs filtered by status, prompt, or stock, newest first. */
export const listJobs = query({
  args: {
    status: v.optional(jobStatus),
    stockId: v.optional(vv.id("stocks")),
    promptId: v.optional(vv.id("prompts")),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 200, 500);
    let jobs;

    if (args.status) {
      jobs = await ctx.db
        .query("researchJobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(maxResults);
    } else if (args.promptId) {
      jobs = await ctx.db
        .query("researchJobs")
        .withIndex("by_promptId", (q) => q.eq("promptId", args.promptId!))
        .order("desc")
        .take(maxResults);
    } else {
      jobs = await ctx.db
        .query("researchJobs")
        .withIndex("by_createdAt")
        .order("desc")
        .take(maxResults);
    }

    // Filter by stockId in memory (stockIds is an array)
    if (args.stockId) {
      jobs = jobs.filter((j) => j.stockIds.includes(args.stockId!));
    }

    return jobs;
  },
});
