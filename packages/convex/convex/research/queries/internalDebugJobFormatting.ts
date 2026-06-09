import { internalQuery } from "../../_generated/server";
import { vv } from "../../schema";
import { countH2 } from "../shared/countH2";
import { countH3 } from "../shared/countH3";

/** Ops: compare raw vs formatted snippets for a job (e.g. verify backfill). */
export const internalDebugJobFormatting = internalQuery({
  args: { jobId: vv.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    const needles = [
      "Model mechanics",
      "Pricing power",
      "sold out of capacity",
    ];
    const snippet = (text: string | undefined) => {
      if (!text) return null;
      for (const needle of needles) {
        const idx = text.indexOf(needle);
        if (idx >= 0) return text.slice(idx, idx + 1200);
      }
      return null;
    };

    const h2Titles =
      job.result?.match(/^## (.+)$/gm)?.map((line) => line.slice(3)) ?? [];

    return {
      status: job.status,
      rawLen: job.rawResult?.length ?? 0,
      resultLen: job.result?.length ?? 0,
      identical: job.rawResult === job.result,
      resultH2Count: countH2(job.result),
      resultH3Count: countH3(job.result),
      resultH2Titles: h2Titles.slice(0, 20),
      rawSnippet: snippet(job.rawResult),
      resultSnippet: snippet(job.result),
    };
  },
});
