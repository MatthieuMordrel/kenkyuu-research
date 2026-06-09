import { RESEARCH_HARNESSES } from "@repo/research-models/harnesses";
import type { ResearchModelDefinition } from "@repo/research-models/types";

// Hard timeout after which a still-running job is marked failed. Agentic
// harnesses iterate produce → grade → revise, so they get more headroom.
const JOB_HARD_TIMEOUT_MS = 90 * 60_000;
const AGENT_JOB_HARD_TIMEOUT_MS = 150 * 60_000;

/** Hard timeout for a research job, based on the model's harness kind. */
export function jobHardTimeoutMs(model: ResearchModelDefinition): number {
  return RESEARCH_HARNESSES[model.harnessId].kind === "agent"
    ? AGENT_JOB_HARD_TIMEOUT_MS
    : JOB_HARD_TIMEOUT_MS;
}
