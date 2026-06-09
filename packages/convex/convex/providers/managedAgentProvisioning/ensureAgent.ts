"use node";

import type Anthropic from "@anthropic-ai/sdk";
import type { Beta } from "@anthropic-ai/sdk/resources/beta";
import { hashParams } from "./hashParams";
import { findAgentByName } from "./findAgentByName";

/** Metadata key recording the config hash from the last provisioning. */
const CONFIG_HASH_METADATA_KEY = "config_hash";

export type AgentParams = Omit<
  Beta.Agents.AgentCreateParams,
  "name" | "metadata"
>;

/**
 * Create the agent if missing, update it in place when the desired config no
 * longer matches the hash recorded at last provisioning. Returns the agent id.
 */
export async function ensureAgent(
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
