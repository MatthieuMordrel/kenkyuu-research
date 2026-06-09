import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";

/** Recent research: last 5 completed or failed jobs with prompt and stock info. */
export const recentResearch = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const jobs = await ctx.db.query("researchJobs").order("desc").take(20);

    // Filter to completed/failed and take 5
    const recent = jobs
      .filter((j) => j.status === "completed" || j.status === "failed")
      .slice(0, 5);

    // Batch-load unique prompts and stocks to avoid N+1 queries
    const uniquePromptIds = [...new Set(recent.map((j) => j.promptId))];
    const uniqueStockIds = [...new Set(recent.flatMap((j) => j.stockIds))];

    const [prompts, stocks] = await Promise.all([
      Promise.all(uniquePromptIds.map((id) => ctx.db.get(id))),
      Promise.all(uniqueStockIds.map((id) => ctx.db.get(id))),
    ]);

    const promptMap = new Map(uniquePromptIds.map((id, i) => [id, prompts[i]]));
    const stockMap = new Map(uniqueStockIds.map((id, i) => [id, stocks[i]]));

    return recent.map((job) => {
      const prompt = promptMap.get(job.promptId);
      return {
        _id: job._id,
        status: job.status,
        promptName: prompt?.name ?? "Deleted prompt",
        promptType: prompt?.type,
        stockTickers: job.stockIds
          .map((id) => stockMap.get(id))
          .filter((s) => s != null)
          .map((s) => s.ticker),
        costUsd: job.costUsd,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        error: job.error,
      };
    });
  },
});
