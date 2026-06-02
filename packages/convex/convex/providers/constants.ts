import { v } from "convex/values";
import {
  DEFAULT_RESEARCH_MODEL_ID,
  getResearchModel,
  isProviderActive,
  LEGACY_PROVIDER_DEFAULT_MODEL,
  resolveActiveModelId,
  resolveStoredModelId,
} from "@repo/research-models/resolve";
import type { ProviderId } from "@repo/research-models/types";
import { RESEARCH_PROVIDER_IDS } from "@repo/research-models/providers";

export type ProviderName = ProviderId;

/** @deprecated Prefer RESEARCH_PROVIDER_IDS from @repo/research-models */
export const PROVIDER_NAMES = RESEARCH_PROVIDER_IDS;

export type { ResearchModelId } from "@repo/research-models/types";
export {
  assertModelActive,
  DEFAULT_RESEARCH_MODEL_ID as DEFAULT_MODEL_ID,
  getResearchModel,
  getResearchModelLabel,
  getSettingsKeyForModel,
  getSettingsKeyForProvider,
  isModelActive,
  isProviderActive,
  jobFieldsForModel,
  resolveActiveModelId,
  resolveStoredModelId,
} from "@repo/research-models/resolve";

export { RESEARCH_MODELS, RESEARCH_MODEL_IDS } from "@repo/research-models/models";
export { RESEARCH_PROVIDERS } from "@repo/research-models/providers";
export { estimateModelCost } from "@repo/research-models/pricing";

/** Convex validator for denormalized provider id on stored documents. */
export const providerValidator = v.union(
  v.literal("openai"),
  v.literal("anthropic")
);

/** Convex validator for model id — validated against registry in mutations. */
export const modelIdValidator = v.string();

/** API key lookup by provider id (one key per vendor). */
export const SETTING_KEY_BY_PROVIDER: Record<ProviderName, string> = {
  openai: "openai_api_key",
  anthropic: "anthropic_api_key",
};

/** Providers that currently have at least one active model. */
export const ACTIVE_PROVIDER_NAMES = RESEARCH_PROVIDER_IDS.filter(
  (id) => isProviderActive(id)
) as ProviderName[];

export type ActiveProviderName = (typeof ACTIVE_PROVIDER_NAMES)[number];

export const DEFAULT_ACTIVE_PROVIDER: ActiveProviderName = getResearchModel(
  DEFAULT_RESEARCH_MODEL_ID
).providerId as ActiveProviderName;

/**
 * @deprecated Use assertModelActive from the model registry instead.
 */
export function assertProviderActive(name: ProviderName): void {
  if (!isProviderActive(name)) {
    throw new Error(
      "OpenAI Deep Research is currently disabled. Use Claude Opus 4.8 instead."
    );
  }
}

/**
 * @deprecated Use resolveActiveModelId / resolveStoredModelId instead.
 */
export function resolveActiveProvider(name: ProviderName): ActiveProviderName {
  const modelId = resolveActiveModelId(LEGACY_PROVIDER_DEFAULT_MODEL[name]);
  return getResearchModel(modelId).providerId as ActiveProviderName;
}

/**
 * Resolve model id from mutation args that may still send legacy provider only.
 */
export function resolveMutationModelId(args: {
  modelId?: string;
  provider?: ProviderName;
}): ReturnType<typeof resolveStoredModelId> {
  return resolveStoredModelId(args);
}
