import type Anthropic from "@anthropic-ai/sdk";
import type { ManagedAgentRuntimeConfig } from "@repo/research-models/types";

/** Shared session environment name for all kenkyuu research jobs. */
const ENVIRONMENT_NAME = "kenkyuu-research";

/** Create the shared session environment if missing. Returns its id. */
export async function ensureEnvironment(
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
