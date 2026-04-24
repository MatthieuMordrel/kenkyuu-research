import type { ProviderName } from "./constants";

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
 * Whether the provider reports completion via webhook (push) or requires
 * us to poll until the job finishes.
 *   - "webhook": we rely on the provider's webhook; poll only as fallback
 *   - "polling": we must schedule recurring `pollJob` actions until terminal
 */
export type CompletionMode = "webhook" | "polling";

/**
 * Provider interface. One implementation per external AI service.
 * Providers are stateless — every call receives the API key explicitly so
 * we can rotate keys without reconstructing provider objects.
 */
export interface ResearchProvider {
  readonly name: ProviderName;
  readonly completionMode: CompletionMode;

  /**
   * Submit a research prompt.
   * Returns the provider-side job/response ID and, when available, the exact
   * prompt that was ultimately submitted after any provider-specific rewriting.
   */
  start(
    prompt: string,
    apiKey: string
  ): Promise<{ externalId: string; submittedPrompt?: string }>;

  /** Check current status of a previously-started job. */
  poll(externalId: string, apiKey: string): Promise<PollResult>;

  /** Estimate the USD cost of a completed job from its usage stats. */
  estimateCost(usage: NormalizedUsage): number;
}
