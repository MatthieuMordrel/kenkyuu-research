import type { ManagedAgentRuntimeConfig } from "@repo/research-models/types";
import { MANAGED_AGENT_COORDINATOR_SYSTEM_PROMPT } from "@repo/research-models/managed-agent-prompt";

/** Coordinator prompt with the registry's parallelism cap appended. */
export function buildCoordinatorSystemPrompt(
  runtime: ManagedAgentRuntimeConfig
): string {
  return `${MANAGED_AGENT_COORDINATOR_SYSTEM_PROMPT}

Resource limits:
- Run at most ${runtime.maxSubagents} researcher subagents in parallel.`;
}
