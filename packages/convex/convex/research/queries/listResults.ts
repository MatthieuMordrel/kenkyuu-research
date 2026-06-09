import { v } from "convex/values";
import { query } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { jobStatus } from "../shared/jobStatus";

/** Paginated research results filtered by status, prompt, stock, or date range. */
export const listResults = query({
  args: {
    status: v.optional(jobStatus),
    stockId: v.optional(vv.id("stocks")),
    promptId: v.optional(vv.id("prompts")),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const pageSize = Math.min(args.limit ?? 20, 100);

    let jobsQuery;

    if (args.status) {
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else if (args.promptId) {
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_promptId", (q) => q.eq("promptId", args.promptId!));
    } else if (args.dateFrom && args.dateTo) {
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_createdAt", (q) =>
          q.gte("createdAt", args.dateFrom!).lte("createdAt", args.dateTo!)
        );
    } else if (args.dateFrom) {
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_createdAt", (q) => q.gte("createdAt", args.dateFrom!));
    } else if (args.dateTo) {
      jobsQuery = ctx.db
        .query("researchJobs")
        .withIndex("by_createdAt", (q) => q.lte("createdAt", args.dateTo!));
    } else {
      jobsQuery = ctx.db.query("researchJobs");
    }

    const paginatedResult = await jobsQuery.order("desc").paginate({
      numItems: pageSize,
      cursor: args.cursor ?? null,
    });

    let results = paginatedResult.page;

    if (args.stockId) {
      results = results.filter((j) => j.stockIds.includes(args.stockId!));
    }

    if ((args.status || args.promptId) && args.dateFrom) {
      results = results.filter((j) => j.createdAt >= args.dateFrom!);
    }
    if ((args.status || args.promptId) && args.dateTo) {
      results = results.filter((j) => j.createdAt <= args.dateTo!);
    }

    return {
      results,
      cursor: paginatedResult.continueCursor,
      isDone: paginatedResult.isDone,
    };
  },
});
