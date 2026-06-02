import type { ResearchModelDefinition } from "./types";

/**
 * Research model registry — single source of truth for selectable models.
 *
 * To add a model:
 * 1. Add a ResearchModelId in types.ts
 * 2. Add an entry below with pricing, apiModel, and completionMode
 * 3. If the vendor SDK call shape differs, extend the matching provider adapter
 *
 * Set active: true to expose the model in UI pickers.
 */
export const RESEARCH_MODELS = {
  "anthropic/claude-opus-4-8": {
    id: "anthropic/claude-opus-4-8",
    providerId: "anthropic",
    label: "Claude Opus 4.8",
    description:
      "Anthropic's most capable model — batch API with adaptive thinking and web search.",
    apiModel: "claude-opus-4-8",
    active: true,
    completionMode: "polling",
    estimatedCostLabel: "~$1–2",
    pricing: {
      inputPerM: 2.5,
      outputPerM: 12.5,
      webSearchPerCall: 0.01,
    },
    anthropic: {
      effort: "xhigh",
      webSearchMaxUses: 100,
      thinkingType: "adaptive",
    },
  },
  "openai/o3-deep-research": {
    id: "openai/o3-deep-research",
    providerId: "openai",
    label: "OpenAI Deep Research (o3)",
    description:
      "OpenAI o3 deep-research via the Responses API with web search and code interpreter.",
    apiModel: "o3-deep-research",
    active: false,
    completionMode: "webhook",
    estimatedCostLabel: "~$3–4",
    pricing: {
      inputPerM: 10,
      outputPerM: 40,
    },
  },
  "openai/o4-mini-deep-research": {
    id: "openai/o4-mini-deep-research",
    providerId: "openai",
    label: "OpenAI Deep Research (o4-mini)",
    description:
      "Placeholder for a future OpenAI deep-research model — enable when available.",
    apiModel: "o4-mini-deep-research",
    active: false,
    completionMode: "webhook",
    estimatedCostLabel: "~$1–2",
    pricing: {
      inputPerM: 5,
      outputPerM: 20,
    },
  },
  "openai/gpt-5.5": {
    id: "openai/gpt-5.5",
    providerId: "openai",
    label: "GPT-5.5",
    description:
      "OpenAI's latest frontier model — xhigh reasoning with deep web search for long-form research.",
    apiModel: "gpt-5.5",
    active: true,
    completionMode: "webhook",
    estimatedCostLabel: "~$2–5",
    pricing: {
      inputPerM: 5,
      outputPerM: 30,
    },
    openai: {
      reasoningEffort: "xhigh",
      maxToolCalls: 150,
      webSearchTool: "web_search",
      webSearchContextSize: "high",
    },
  },
} as const satisfies Record<string, ResearchModelDefinition>;

/** All registered model ids. */
export const RESEARCH_MODEL_IDS = Object.keys(
  RESEARCH_MODELS
) as (keyof typeof RESEARCH_MODELS)[];
