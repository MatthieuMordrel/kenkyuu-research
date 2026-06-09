import type { ModelPricing, NormalizedUsage, ProviderId } from "./types";

/**
 * Registry id for the default research output formatter (OpenAI Responses, background).
 */
export const DEFAULT_FORMAT_MODEL_ID = "openai/gpt-4.1-mini" as const;

export type FormatModelId = typeof DEFAULT_FORMAT_MODEL_ID;

/**
 * Metadata for the model used only to polish completed research markdown.
 * @property id - Stable registry key for cost logs
 * @property providerId - Vendor providing the API key
 * @property label - Display name
 * @property apiModel - Provider API model string
 * @property pricing - Token rates for estimateFormatCost
 */
export interface FormatModelDefinition {
  id: FormatModelId;
  providerId: ProviderId;
  label: string;
  apiModel: string;
  pricing: ModelPricing;
}

/** Formatter model registry (OpenAI Responses API, no tools). */
export const FORMAT_MODELS: Record<FormatModelId, FormatModelDefinition> = {
  "openai/gpt-4.1-mini": {
    id: "openai/gpt-4.1-mini",
    providerId: "openai",
    label: "GPT-4.1 mini",
    apiModel: "gpt-4.1-mini",
    pricing: {
      inputPerM: 0.4,
      outputPerM: 1.6,
    },
  },
};

/**
 * Resolves a formatter model id, falling back to the default OpenAI entry.
 */
export function resolveFormatModel(modelId?: string): FormatModelDefinition {
  if (modelId && modelId in FORMAT_MODELS) {
    return FORMAT_MODELS[modelId as FormatModelId];
  }
  return FORMAT_MODELS[DEFAULT_FORMAT_MODEL_ID];
}

/**
 * Estimates USD cost for a formatting pass from token usage.
 */
export function estimateFormatCost(
  model: FormatModelDefinition,
  usage: NormalizedUsage
): number {
  const tokenCost =
    (usage.inputTokens * model.pricing.inputPerM +
      usage.outputTokens * model.pricing.outputPerM) /
    1_000_000;
  return tokenCost;
}
