import type { ResearchProviderDefinition } from "./types";

/**
 * Vendor registry. Add a row here when integrating a new AI provider SDK.
 * Each model references a providerId for API key lookup.
 */
export const RESEARCH_PROVIDERS = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    settingsKey: "anthropic_api_key",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    settingsKey: "openai_api_key",
  },
} as const satisfies Record<string, ResearchProviderDefinition>;

/** All registered provider ids. */
export const RESEARCH_PROVIDER_IDS = Object.keys(
  RESEARCH_PROVIDERS
) as (keyof typeof RESEARCH_PROVIDERS)[];
