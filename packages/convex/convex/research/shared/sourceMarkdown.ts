import type { Doc } from "../../_generated/dataModel";

/** Picks the markdown source to format based on the job's phase. */
export function sourceMarkdown(job: Doc<"researchJobs">): string | null {
  if (job.status === "formatting" && job.rawResult) {
    return job.rawResult;
  }
  if (job.status === "completed") {
    return job.rawResult ?? job.result ?? null;
  }
  return null;
}
