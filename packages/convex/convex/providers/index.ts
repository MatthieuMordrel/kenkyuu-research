"use node";

import { getResearchModel, resolveStoredModelId } from "@repo/research-models/resolve";
import type { ResearchModelDefinition } from "@repo/research-models/types";
import type { ProviderId } from "@repo/research-models/types";
import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";
import type { ResearchProviderAdapter } from "./types";
import type { ProviderName } from "./constants";

const ADAPTERS: Record<ProviderId, ResearchProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
};

/**
 * Returns the SDK adapter for a vendor.
 */
export function getProviderAdapter(
  providerId: ProviderId
): ResearchProviderAdapter {
  return ADAPTERS[providerId];
}

/**
 * Resolves the model definition for a stored job or prompt row.
 */
export function resolveJobModel(args: {
  modelId?: string | null;
  provider?: ProviderName | null;
}): ResearchModelDefinition {
  const modelId = resolveStoredModelId(args);
  return getResearchModel(modelId);
}

/** @deprecated Use getProviderAdapter */
export function getProvider(name: ProviderName): ResearchProviderAdapter {
  return getProviderAdapter(name);
}

export type { ResearchProviderAdapter, PollResult, NormalizedUsage } from "./types";
export type { ResearchProvider } from "./types";
export {
  ACTIVE_PROVIDER_NAMES,
  assertModelActive,
  assertProviderActive,
  DEFAULT_MODEL_ID,
  estimateModelCost,
  getResearchModel,
  getResearchModelLabel,
  getSettingsKeyForModel,
  getSettingsKeyForProvider,
  isModelActive,
  isProviderActive,
  jobFieldsForModel,
  modelIdValidator,
  providerValidator,
  resolveActiveModelId,
  resolveMutationModelId,
  resolveStoredModelId,
  RESEARCH_MODELS,
  RESEARCH_PROVIDERS,
  SETTING_KEY_BY_PROVIDER,
} from "./constants";
export type { ActiveProviderName, ProviderName, ResearchModelId } from "./constants";
