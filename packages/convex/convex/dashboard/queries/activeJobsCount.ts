import { v } from "convex/values";
import { query } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import {
  asConcurrencyJobs,
  buildAllProviderConcurrencySnapshots,
  MAX_ACTIVE_JOBS_SCAN,
} from "../../researchConcurrency";

/** Active jobs count with per-provider concurrency snapshots. */
export const activeJobsCount = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const pendingJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(MAX_ACTIVE_JOBS_SCAN);
    const runningJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(MAX_ACTIVE_JOBS_SCAN);
    const formattingJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "formatting"))
      .take(MAX_ACTIVE_JOBS_SCAN);
    const queueJobs = [...pendingJobs, ...runningJobs];
    const byProvider = buildAllProviderConcurrencySnapshots(
      asConcurrencyJobs(queueJobs)
    );

    return {
      pending: pendingJobs.length,
      running: runningJobs.length,
      formatting: formattingJobs.length,
      total: queueJobs.length + formattingJobs.length,
      byProvider,
    };
  },
});
