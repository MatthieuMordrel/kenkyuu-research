import type { ResearchModelDefinition } from "@repo/research-models/types";
import type { ProviderId } from "@repo/research-models/types";

/**
 * Minimal usage shape normalized across providers for cost estimation.
 * Providers extract these fields from their native response payloads.
 */
export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  /** Number of server-side web searches performed. Only some providers bill this. */
  webSearchRequests?: number;
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
 * Vendor adapter — one implementation per external AI SDK.
 * Model-specific API parameters live in the registry; adapters receive the
 * resolved model definition at runtime.
 */
export interface ResearchProviderAdapter {
  readonly providerId: ProviderId;

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

/** @deprecated Use ResearchProviderAdapter */
export type ResearchProvider = ResearchProviderAdapter & {
  readonly name: ProviderId;
  readonly completionMode: ResearchModelDefinition["completionMode"];
  start(prompt: string, apiKey: string): Promise<{
    externalId: string;
    submittedPrompt?: string;
  }>;
  poll(externalId: string, apiKey: string): Promise<PollResult>;
  estimateCost(usage: NormalizedUsage): number;
};
