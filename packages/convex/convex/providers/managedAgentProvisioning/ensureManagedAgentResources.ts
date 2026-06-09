"use node";

import type Anthropic from "@anthropic-ai/sdk";
import type {
  ManagedAgentRuntimeConfig,
  ResearchModelDefinition,
} from "@repo/research-models/types";
import { MANAGED_AGENT_RESEARCHER_SYSTEM_PROMPT } from "@repo/research-models/managed-agent-prompt";
import { agentName } from "./agentName";
import { buildToolset } from "./buildToolset";
import { buildCoordinatorSystemPrompt } from "./buildCoordinatorSystemPrompt";
import { ensureAgent } from "./ensureAgent";
import { ensureEnvironment } from "./ensureEnvironment";

/**
 * Idempotent provisioning for Managed Agents resources.
 *
 * Agents and environments are persistent, versioned API objects that must be
 * created once and referenced per run — never re-created in the request path.
 * Rather than persisting their IDs in Convex, this module treats the Anthropic
 * API as the source of truth: resources are looked up by name, and config
 * drift is detected via a hash of the desired params stored in agent metadata.
 * When the registry config changes, the agent is updated in place (which bumps
 * its server-side version); running sessions keep their pinned version.
 */

export interface ManagedAgentResources {
  environmentId: string;
  coordinatorAgentId: string;
}

/**
 * Ensure environment + researcher + coordinator exist and match the registry
 * config for this model. Safe to call on every job start.
 */
export async function ensureManagedAgentResources(
  client: Anthropic,
  model: ResearchModelDefinition,
  runtime: ManagedAgentRuntimeConfig
): Promise<ManagedAgentResources> {
  const environmentId = await ensureEnvironment(client, runtime);

  const researcherAgentId = await ensureAgent(
    client,
    agentName("researcher", model.id),
    {
      model: runtime.researcherModel,
      description: `Researcher subagent for ${model.label} research jobs.`,
      system: MANAGED_AGENT_RESEARCHER_SYSTEM_PROMPT,
      tools: [buildToolset(runtime)],
    }
  );

  const coordinatorAgentId = await ensureAgent(
    client,
    agentName("coordinator", model.id),
    {
      model: runtime.coordinatorModel,
      description: `Coordinator for ${model.label} research jobs.`,
      system: buildCoordinatorSystemPrompt(runtime),
      tools: [buildToolset(runtime)],
      multiagent: {
        type: "coordinator",
        // String entries pin to the researcher's latest version, so researcher
        // updates don't require touching the coordinator.
        agents: [researcherAgentId],
      },
    }
  );

  return { environmentId, coordinatorAgentId };
}
