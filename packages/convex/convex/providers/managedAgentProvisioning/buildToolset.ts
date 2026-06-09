import type { Beta } from "@anthropic-ai/sdk/resources/beta";
import type { ManagedAgentRuntimeConfig } from "@repo/research-models/types";

/** Built-in toolset with the registry's web tool toggles applied. */
export function buildToolset(
  runtime: ManagedAgentRuntimeConfig
): Beta.Agents.BetaManagedAgentsAgentToolset20260401Params {
  return {
    type: "agent_toolset_20260401",
    default_config: { enabled: true },
    configs: [
      { name: "web_search", enabled: runtime.webSearch },
      { name: "web_fetch", enabled: runtime.webFetch },
    ],
  };
}
