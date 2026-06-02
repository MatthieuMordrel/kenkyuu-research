/**
 * Vendor identifier for an AI provider integration (SDK + API key).
 * @property openai - OpenAI Responses / deep-research API
 * @property anthropic - Anthropic Messages / Batch API
 */
export type ProviderId = "openai" | "anthropic";

/**
 * Stable registry key for a research model. Format: `{providerId}/{slug}`.
 * Stored on prompts, jobs, schedules, and cost logs.
 */
export type ResearchModelId =
  | "anthropic/claude-opus-4-8"
  | "openai/o3-deep-research"
  | "openai/o4-mini-deep-research";

/** How job completion is detected for a model integration. */
export type CompletionMode = "webhook" | "polling";

/**
 * Token and tool pricing for cost estimation (USD).
 * @property inputPerM - Cost per million input tokens
 * @property outputPerM - Cost per million output tokens
 * @property webSearchPerCall - Optional per-search surcharge
 */
export interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
  webSearchPerCall?: number;
}

/**
 * Metadata for one selectable research model.
 * @property id - Registry id persisted in Convex
 * @property providerId - Vendor that executes this model
 * @property label - Human-readable name for UI
 * @property description - Short capability summary for pickers
 * @property apiModel - Provider API model string passed to the SDK
 * @property active - When false, hidden from pickers and upgraded on job start
 * @property completionMode - Webhook vs polling completion strategy
 * @property estimatedCostLabel - Rough cost range shown in the wizard
 * @property pricing - Rates used by estimateModelCost
 */
export interface ResearchModelDefinition {
  id: ResearchModelId;
  providerId: ProviderId;
  label: string;
  description: string;
  apiModel: string;
  active: boolean;
  completionMode: CompletionMode;
  estimatedCostLabel: string;
  pricing: ModelPricing;
}

/**
 * Vendor-level configuration shared by all models from that provider.
 * @property id - Provider id
 * @property label - Display name
 * @property settingsKey - Convex settings row key for the API key
 */
export interface ResearchProviderDefinition {
  id: ProviderId;
  label: string;
  settingsKey: string;
}

/** Normalized usage for cost estimation across providers. */
export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  webSearchRequests?: number;
}
