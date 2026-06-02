import { v } from "convex/values";

export const PROVIDER_NAMES = ["openai", "anthropic"] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

/** Providers available for new research jobs, prompts, and schedules. */
export const ACTIVE_PROVIDER_NAMES = ["anthropic"] as const;

export type ActiveProviderName = (typeof ACTIVE_PROVIDER_NAMES)[number];

export const DEFAULT_ACTIVE_PROVIDER: ActiveProviderName = "anthropic";

export const providerValidator = v.union(
  v.literal("openai"),
  v.literal("anthropic")
);

export const SETTING_KEY_BY_PROVIDER: Record<ProviderName, string> = {
  openai: "openai_api_key",
  anthropic: "anthropic_api_key",
};

/**
 * Whether a provider can be selected for new work.
 * Inactive providers remain registered so in-flight jobs can still be polled.
 */
export function isProviderActive(name: ProviderName): name is ActiveProviderName {
  return (ACTIVE_PROVIDER_NAMES as readonly ProviderName[]).includes(name);
}

/**
 * Reject disabled providers at mutation boundaries (prompt/schedule config).
 */
export function assertProviderActive(name: ProviderName): void {
  if (!isProviderActive(name)) {
    throw new Error(
      "OpenAI Deep Research is currently disabled. Use Claude Opus 4.8 instead."
    );
  }
}

/**
 * Map stored provider values to an active provider when starting jobs.
 * Existing prompts/schedules that still reference OpenAI are upgraded silently.
 */
export function resolveActiveProvider(name: ProviderName): ActiveProviderName {
  return isProviderActive(name) ? name : DEFAULT_ACTIVE_PROVIDER;
}
