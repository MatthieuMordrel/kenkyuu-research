import type {
  NormalizedUsage as RegistryNormalizedUsage,
  ProviderId,
  ResearchHarnessId,
  ResearchModelDefinition,
} from "@repo/research-models/types";

/**
 * Usage shape normalized across providers. Extends the registry's cost
 * estimation fields (tokens, searches, duration) with display-only stats.
 */
export interface NormalizedUsage extends RegistryNormalizedUsage {
  /**
   * Total tool/web-search invocations the provider performed, for usage display
   * against the model's configured allocation. May exceed webSearchRequests when
   * a provider counts non-search tools (e.g. OpenAI's combined tool-call cap).
   */
  toolCalls?: number;
}

/** Result of polling a provider for the status of a job. */
export type PollResult =
  | { status: "running" }
  | {
      status: "completed";
      text: string;
      usage: NormalizedUsage;
    }
  | { status: "failed"; error: string }
  | { status: "cancelled" };

/**
 * Harness adapter — one implementation per execution engine (SDK call shape).
 * Model-specific API parameters live in the registry; adapters receive the
 * resolved model definition at runtime. The providerId scopes API key lookup.
 */
export interface ResearchProviderAdapter {
  readonly providerId: ProviderId;
  readonly harnessId: ResearchHarnessId;

  /**
   * Submit a research prompt for the given model.
   * Returns the provider-side job/response ID and, when available, the exact
   * prompt that was ultimately submitted after any provider-specific rewriting.
   */
  start(
    model: ResearchModelDefinition,
    prompt: string,
    apiKey: string
  ): Promise<{ externalId: string; submittedPrompt?: string }>;

  /** Check current status of a previously-started job. */
  poll(
    model: ResearchModelDefinition,
    externalId: string,
    apiKey: string
  ): Promise<PollResult>;
}
