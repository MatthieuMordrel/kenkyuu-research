import type { ModelPricing, NormalizedUsage } from "./types";

/**
 * Registry id for the default research output formatter (not a research model).
 * Haiku is fast enough for chunked passes; Sonnet available when quality trumps speed.
 */
export const DEFAULT_FORMAT_MODEL_ID = "anthropic/claude-haiku-4-5" as const;

export type FormatModelId =
  | "anthropic/claude-haiku-4-5"
  | "anthropic/claude-sonnet-4-5";

/**
 * Metadata for a cheap model used only to polish completed research markdown.
 * @property id - Stable registry key for cost logs
 * @property providerId - Vendor providing the API key
 * @property label - Display name
 * @property apiModel - Provider API model string
 * @property pricing - Token rates for estimateModelCost
 */
export interface FormatModelDefinition {
  id: FormatModelId;
  providerId: "anthropic";
  label: string;
  apiModel: string;
  pricing: ModelPricing;
}

/** Selectable formatter models (sync Messages API, no web search). */
export const FORMAT_MODELS: Record<FormatModelId, FormatModelDefinition> = {
  "anthropic/claude-sonnet-4-5": {
    id: "anthropic/claude-sonnet-4-5",
    providerId: "anthropic",
    label: "Claude Sonnet 4.5",
    apiModel: "claude-sonnet-4-5",
    pricing: {
      inputPerM: 3,
      outputPerM: 15,
    },
  },
  "anthropic/claude-haiku-4-5": {
    id: "anthropic/claude-haiku-4-5",
    providerId: "anthropic",
    label: "Claude Haiku 4.5",
    apiModel: "claude-haiku-4-5",
    pricing: {
      inputPerM: 0.8,
      outputPerM: 4,
    },
  },
};

/**
 * Resolves a formatter model id, falling back to the default Haiku entry.
 */
export function resolveFormatModel(
  modelId?: string
): FormatModelDefinition {
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
