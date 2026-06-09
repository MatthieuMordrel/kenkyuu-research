import { RESEARCH_HARNESSES } from "./harnesses";
import { RESEARCH_PROVIDERS } from "./providers";
import type {
  AnthropicEffort,
  OpenAIReasoningEffort,
  ResearchModelDefinition,
} from "./types";

/**
 * One labeled spec row for model picker detail panels.
 * @property label - Human-readable setting name
 * @property value - Active setting value (raw slug, used for chip highlighting)
 * @property options - When set, UI renders all options and highlights `value`
 */
export interface ModelDetailRow {
  label: string;
  value: string;
  options?: readonly string[];
}

/** All Anthropic effort levels, low → xhigh. */
export const ANTHROPIC_EFFORT_OPTIONS = [
  "low",
  "medium",
  "high",
  "xhigh",
] as const satisfies readonly AnthropicEffort[];

/** All Anthropic thinking modes. Opus 4.8 uses adaptive. */
export const ANTHROPIC_THINKING_OPTIONS = [
  "disabled",
  "enabled",
  "adaptive",
] as const;

/** All OpenAI reasoning effort levels. */
export const OPENAI_REASONING_EFFORT_OPTIONS = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
] as const satisfies readonly OpenAIReasoningEffort[];

/** Shown when output token limit is resolved from the provider at request time. */
export const MODEL_MAX_OUTPUT_TOKENS_LABEL = "Maximum";

/** Format large integers for UI (e.g. 128000 → "128,000"). */
function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** Capitalize the first letter of a slug-like value for display. */
export function formatModelDetailOption(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Build human-readable configuration rows for a research model.
 * Used by the research wizard and prompt modal when a model is selected.
 */
export function getResearchModelDetailRows(
  model: ResearchModelDefinition
): ModelDetailRow[] {
  const rows: ModelDetailRow[] = [
    {
      label: "Provider",
      value: RESEARCH_PROVIDERS[model.providerId].label,
    },
    {
      label: "Harness",
      value: RESEARCH_HARNESSES[model.harnessId].label,
    },
    {
      label: "Est. cost",
      value: model.estimatedCostLabel,
    },
  ];

  if (model.openai) {
    rows.push({
      label: "Reasoning effort",
      value: model.openai.reasoningEffort,
      options: OPENAI_REASONING_EFFORT_OPTIONS,
    });
    rows.push({
      label: "Max tool calls",
      value: formatCount(model.openai.maxToolCalls),
    });
    if (model.openai.maxOutputTokens !== undefined) {
      rows.push({
        label: "Max output tokens",
        value: formatCount(model.openai.maxOutputTokens),
      });
    }
    if (model.openai.webSearchTool) {
      const searchLabel =
        model.openai.webSearchTool === "web_search"
          ? "Web search"
          : "Web search (preview)";
      const searchValue = model.openai.webSearchContextSize
        ? `${formatModelDetailOption(model.openai.webSearchContextSize)} context`
        : formatModelDetailOption(
            model.openai.webSearchTool.replace(/_/g, " ")
          );
      rows.push({ label: searchLabel, value: searchValue });
    }
  }

  if (model.anthropic) {
    rows.push({
      label: "Effort",
      value: model.anthropic.effort,
      options: ANTHROPIC_EFFORT_OPTIONS,
    });
    rows.push({
      label: "Thinking",
      value: model.anthropic.thinkingType,
      options: ANTHROPIC_THINKING_OPTIONS,
    });
    rows.push({
      label: "Max web searches",
      value: formatCount(model.anthropic.webSearchMaxUses),
    });
    rows.push({
      label: "Max output tokens",
      value: MODEL_MAX_OUTPUT_TOKENS_LABEL,
    });
  }

  if (model.managedAgent) {
    rows.push({
      label: "Coordinator model",
      value: model.managedAgent.coordinatorModel,
    });
    rows.push({
      label: "Researcher model",
      value: model.managedAgent.researcherModel,
    });
    rows.push({
      label: "Parallel researchers",
      value: formatCount(model.managedAgent.maxSubagents),
    });
    rows.push({
      label: "Review iterations",
      value: formatCount(model.managedAgent.outcomeMaxIterations),
    });
    rows.push({
      label: "Tools",
      value: [
        model.managedAgent.webSearch ? "Web search" : null,
        model.managedAgent.webFetch ? "Web fetch" : null,
        "Bash + files",
      ]
        .filter(Boolean)
        .join(", "),
    });
    rows.push({
      label: "Thinking",
      value: "Managed by harness",
    });
  }

  return rows;
}
