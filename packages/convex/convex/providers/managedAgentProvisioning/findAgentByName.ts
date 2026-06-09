import type Anthropic from "@anthropic-ai/sdk";
import type { Beta } from "@anthropic-ai/sdk/resources/beta";

/** Find a live (non-archived) agent by exact name. */
export async function findAgentByName(
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
