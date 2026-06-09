import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Ops: length distribution of completed research outputs (empirical sizing).
 * Used to validate whether multi-chunk formatting is needed.
 */
export const internalSummarizeResearchResultSizes = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 200, 500);
    const jobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(limit);

    const lengths = jobs
      .map((j) => j.rawResult?.length ?? j.result?.length ?? 0)
      .filter((n) => n > 0)
      .toSorted((a, b) => a - b);

    const percentile = (p: number) => {
      if (lengths.length === 0) return 0;
      const idx = Math.min(
        lengths.length - 1,
        Math.floor((p / 100) * lengths.length)
      );
      return lengths[idx] ?? 0;
    };

    return {
      sampleCount: lengths.length,
      min: lengths[0] ?? 0,
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      max: lengths[lengths.length - 1] ?? 0,
    };
  },
});
