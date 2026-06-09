import type { ResearchHarnessDefinition, ResearchHarnessId } from "./types";

/**
 * Execution harness registry. Add a row here when integrating a new way of
 * running research (a new SDK call shape / adapter), then reference its id
 * from model entries via `harnessId`.
 */
export const RESEARCH_HARNESSES = {
  "anthropic-batch": {
    id: "anthropic-batch",
    kind: "api",
    label: "Batch API",
    description:
      "Single autonomous model loop via the Anthropic Batch API — 50% token discount.",
  },
  "openai-responses": {
    id: "openai-responses",
    kind: "api",
    label: "Responses API",
    description:
      "Single autonomous model loop via the OpenAI Responses API with webhook completion.",
  },
  "anthropic-managed-agents": {
    id: "anthropic-managed-agents",
    kind: "agent",
    label: "Managed Agent",
    description:
      "Anthropic-hosted agent harness — parallel researcher subagents and a rubric-graded revise loop. Standard token rates.",
  },
} as const satisfies Record<ResearchHarnessId, ResearchHarnessDefinition>;
