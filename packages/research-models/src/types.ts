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
  | "anthropic/claude-fable-5"
  | "anthropic/claude-fable-5-agent"
  | "anthropic/claude-opus-4-8"
  | "openai/o3-deep-research"
  | "openai/o4-mini-deep-research"
  | "openai/gpt-5.5";

/**
 * Execution engine that runs a research job. Each harness has its own SDK
 * call shape and adapter; multiple models can share one harness.
 * @property anthropic-batch - Single autonomous loop via the Anthropic Batch API
 * @property openai-responses - Single autonomous loop via the OpenAI Responses API
 * @property anthropic-managed-agents - Anthropic-hosted agent harness (sessions, subagents, outcomes)
 */
export type ResearchHarnessId =
  | "anthropic-batch"
  | "openai-responses"
  | "anthropic-managed-agents";

/**
 * Broad harness category used for UI grouping and badge styling.
 * @property api - One model request; the provider runs a single autonomous loop
 * @property agent - Hosted agentic harness with tools, subagents, and iteration
 */
export type ResearchHarnessKind = "api" | "agent";

/**
 * Metadata for one execution harness.
 * @property id - Harness id referenced by models
 * @property kind - Category for UI grouping/badges
 * @property label - Short badge text (e.g. "Batch API", "Managed Agent")
 * @property description - One-line explanation shown in pickers
 */
export interface ResearchHarnessDefinition {
  id: ResearchHarnessId;
  kind: ResearchHarnessKind;
  label: string;
  description: string;
}

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
 * @property maxOutputTokens - Optional cap; omit to use the provider model maximum
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
 * @property webSearchMaxUses - Cap on web search tool invocations
 * @property thinkingType - Thinking mode (adaptive for Fable 5 / Opus 4.8; "disabled" is rejected by Fable 5)
 */
export interface AnthropicModelRuntimeConfig {
  effort: AnthropicEffort;
  webSearchMaxUses: number;
  thinkingType: "adaptive" | "enabled" | "disabled";
}

/**
 * Per-model Managed Agents (Anthropic-hosted agent harness) runtime settings.
 * Thinking and context management are handled by the harness itself and are
 * not configurable here.
 * @property coordinatorModel - API model string for the coordinator agent
 * @property researcherModel - API model string for parallel researcher subagents
 * @property maxSubagents - Researcher copies the coordinator may run in parallel (≤20)
 * @property outcomeMaxIterations - Grade-and-revise loop cap (1–20); main quality/cost dial
 * @property webSearch - Enable the built-in web_search tool
 * @property webFetch - Enable the built-in web_fetch tool
 * @property networking - Container egress policy for the session sandbox
 */
export interface ManagedAgentRuntimeConfig {
  coordinatorModel: string;
  researcherModel: string;
  maxSubagents: number;
  outcomeMaxIterations: number;
  webSearch: boolean;
  webFetch: boolean;
  networking: "unrestricted" | "limited";
}

/** How job completion is detected for a model integration. */
export type CompletionMode = "webhook" | "polling";

/**
 * Token and tool pricing for cost estimation (USD).
 * @property inputPerM - Cost per million input tokens
 * @property outputPerM - Cost per million output tokens
 * @property webSearchPerCall - Optional per-search surcharge
 * @property sessionPerHour - Optional hosted-session surcharge (Managed Agents)
 */
export interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
  webSearchPerCall?: number;
  sessionPerHour?: number;
}

/**
 * Metadata for one selectable research model.
 * @property id - Registry id persisted in Convex
 * @property providerId - Vendor that executes this model (API key scope)
 * @property harnessId - Execution engine that runs the job (adapter dispatch)
 * @property label - Human-readable name for UI
 * @property description - Short capability summary for pickers
 * @property apiModel - Provider API model string passed to the SDK
 * @property active - When false, hidden from pickers and upgraded on job start
 * @property completionMode - Webhook vs polling completion strategy
 * @property estimatedCostLabel - Rough cost range shown in the wizard
 * @property pricing - Rates used by estimateModelCost
 * @property openai - OpenAI-specific runtime parameters (when harnessId is openai-responses)
 * @property anthropic - Anthropic-specific runtime parameters (when harnessId is anthropic-batch)
 * @property managedAgent - Managed Agents runtime parameters (when harnessId is anthropic-managed-agents)
 */
export interface ResearchModelDefinition {
  id: ResearchModelId;
  providerId: ProviderId;
  harnessId: ResearchHarnessId;
  label: string;
  description: string;
  apiModel: string;
  active: boolean;
  completionMode: CompletionMode;
  estimatedCostLabel: string;
  pricing: ModelPricing;
  openai?: OpenAIModelRuntimeConfig;
  anthropic?: AnthropicModelRuntimeConfig;
  managedAgent?: ManagedAgentRuntimeConfig;
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
  /** Wall-clock duration; only used when pricing has a session-hour surcharge. */
  durationMs?: number;
}
