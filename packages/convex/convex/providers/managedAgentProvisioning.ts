"use node";

import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { Beta } from "@anthropic-ai/sdk/resources/beta";
import type {
  ManagedAgentRuntimeConfig,
  ResearchModelDefinition,
} from "@repo/research-models/types";
import {
  MANAGED_AGENT_COORDINATOR_SYSTEM_PROMPT,
  MANAGED_AGENT_RESEARCHER_SYSTEM_PROMPT,
} from "@repo/research-models/managed-agent-prompt";

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

const ENVIRONMENT_NAME = "kenkyuu-research";
const CONFIG_HASH_METADATA_KEY = "config_hash";

/** Resource names are scoped per registry model id so configs never collide. */
function agentName(
  role: "coordinator" | "researcher",
  modelId: string
): string {
  return `kenkyuu-research/${role}/${modelId}`;
}

function hashParams(params: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(params))
    .digest("hex")
    .slice(0, 32);
}

type AgentParams = Omit<Beta.Agents.AgentCreateParams, "name" | "metadata">;

/** Built-in toolset with the registry's web tool toggles applied. */
function buildToolset(
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

/** Find a live (non-archived) agent by exact name. */
async function findAgentByName(
  client: Anthropic,
  name: string
): Promise<Beta.Agents.BetaManagedAgentsAgent | null> {
  for await (const agent of client.beta.agents.list()) {
    if (agent.name === name && agent.archived_at === null) {
      return agent;
    }
  }
  return null;
}

/**
 * Create the agent if missing, update it in place when the desired config no
 * longer matches the hash recorded at last provisioning. Returns the agent id.
 */
async function ensureAgent(
  client: Anthropic,
  name: string,
  params: AgentParams
): Promise<string> {
  const hash = hashParams(params);
  const metadata = { [CONFIG_HASH_METADATA_KEY]: hash };

  const existing = await findAgentByName(client, name);
  if (!existing) {
    const created = await client.beta.agents.create({
      ...params,
      name,
      metadata,
    });
    return created.id;
  }

  if (existing.metadata[CONFIG_HASH_METADATA_KEY] !== hash) {
    await client.beta.agents.update(existing.id, {
      ...params,
      version: existing.version,
      metadata,
    });
  }
  return existing.id;
}

/** Create the shared session environment if missing. Returns its id. */
async function ensureEnvironment(
  client: Anthropic,
  runtime: ManagedAgentRuntimeConfig
): Promise<string> {
  for await (const environment of client.beta.environments.list()) {
    if (
      environment.name === ENVIRONMENT_NAME &&
      environment.archived_at === null
    ) {
      return environment.id;
    }
  }

  const created = await client.beta.environments.create({
    name: ENVIRONMENT_NAME,
    description: "Session containers for kenkyuu research jobs.",
    config: {
      type: "cloud",
      networking:
        runtime.networking === "unrestricted"
          ? { type: "unrestricted" }
          : { type: "limited" },
    },
  });
  return created.id;
}

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

/** Coordinator prompt with the registry's parallelism cap appended. */
function buildCoordinatorSystemPrompt(
  runtime: ManagedAgentRuntimeConfig
): string {
  return `${MANAGED_AGENT_COORDINATOR_SYSTEM_PROMPT}

Resource limits:
- Run at most ${runtime.maxSubagents} researcher subagents in parallel.`;
}
