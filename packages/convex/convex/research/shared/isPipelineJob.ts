import type { Doc } from "../../_generated/dataModel";

/** Whether a job is currently in the live formatting pipeline phase. */
export function isPipelineJob(job: Doc<"researchJobs">): boolean {
  return job.status === "formatting";
}
