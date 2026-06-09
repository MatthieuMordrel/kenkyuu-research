import type { Doc } from "../../_generated/dataModel";

/** Whether a research job status is terminal (completed or failed). */
export function isTerminal(status: Doc<"researchJobs">["status"]): boolean {
  return status === "completed" || status === "failed";
}
