"use node";

import type { ProviderName } from "./constants";
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import type { ResearchProvider } from "./types";

const PROVIDERS: Record<ProviderName, ResearchProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

export function getProvider(name: ProviderName): ResearchProvider {
  return PROVIDERS[name];
}

export type { ResearchProvider, PollResult, NormalizedUsage } from "./types";
export { PROVIDER_NAMES, SETTING_KEY_BY_PROVIDER } from "./constants";
export type { ProviderName } from "./constants";
