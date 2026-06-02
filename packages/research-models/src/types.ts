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
  | "openai/o4-mini-deep-research"
  | "openai/gpt-5.5";

/** OpenAI reasoning effort levels for Responses API models. */
export type OpenAIReasoningEffort =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

/**
 * Per-model OpenAI Responses API runtime settings.
 * @property reasoningEffort - Thinking depth (`xhigh` for deep research)
 * @property maxToolCalls - Cap on total built-in tool invocations per response
 * @property maxOutputTokens - Upper bound on generated tokens including reasoning
 * @property webSearchTool - Modern `web_search` vs legacy `web_search_preview`
 * @property webSearchContextSize - How much search context to retain
 */
export interface OpenAIModelRuntimeConfig {
  reasoningEffort: OpenAIReasoningEffort;
  maxToolCalls: number;
  maxOutputTokens?: number;
  webSearchTool?: "web_search" | "web_search_preview";
  webSearchContextSize?: "low" | "medium" | "high";
}

/** Anthropic adaptive thinking effort levels. */
export type AnthropicEffort = "low" | "medium" | "high" | "xhigh";

/**
 * Per-model Anthropic Batch API runtime settings.
 * @property effort - Adaptive thinking depth
 * @property maxTokens - Max output tokens for the research turn
 * @property webSearchMaxUses - Cap on web search tool invocations
 * @property thinkingType - Thinking mode (adaptive for Opus 4.8)
 */
export interface AnthropicModelRuntimeConfig {
  effort: AnthropicEffort;
  maxTokens: number;
  webSearchMaxUses: number;
  thinkingType: "adaptive" | "enabled" | "disabled";
}

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
 * @property openai - OpenAI-specific runtime parameters (when providerId is openai)
 * @property anthropic - Anthropic-specific runtime parameters (when providerId is anthropic)
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
  openai?: OpenAIModelRuntimeConfig;
  anthropic?: AnthropicModelRuntimeConfig;
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
