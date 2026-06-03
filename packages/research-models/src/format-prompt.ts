import {
  DEFAULT_FORMAT_MODEL_ID,
  resolveFormatModel,
  type FormatModelId,
} from "./format-models";
import { RESEARCH_PROVIDERS } from "./providers";

/**
 * System prompt sent to the formatter model after research completes.
 * Light touch: polish markdown without reworking the report structure or content.
 */
export const FORMAT_SYSTEM_PROMPT = `Format the research report in the user message as clean GitHub-flavored markdown. Improve readability (spacing, paragraphs, lists, tables) without changing meaning.

Heading rules (critical — do not flatten the outline):
- Preserve every existing ATX heading level exactly (# vs ## vs ###). Never demote a # heading to ## or promote body text to a heading.
- Reports with "# Section N — …" main parts must keep those as # (single hash). Subsections stay ##; sub-subsections stay ###.
- The document title stays one # line at the top. Do not add extra # or ## headings for content that is already a bold lead-in paragraph (e.g. "**Bottom line:** …" must remain inline, not "## Bottom line").
- Do not merge, split, rename, or reorder sections.

Keep all facts, numbers, dates, tickers, links, and citations unchanged. Return only the markdown document—no preamble or code fences.`;

/**
 * Read-only snapshot of the post-research formatting pipeline for UI display.
 * @property modelId - Registry id used for cost logs
 * @property modelLabel - Human-readable model name
 * @property apiModel - Provider API model string
 * @property providerLabel - Vendor display name
 * @property temperature - Sampling temperature for formatter calls
 * @property systemPrompt - System message sent to the formatter
 * @property userMessageDescription - How the user role content is built at runtime
 * @property completionDescription - How the async OpenAI job is run and completed
 */
export interface ResearchFormatPromptView {
  modelId: FormatModelId;
  modelLabel: string;
  apiModel: string;
  providerLabel: string;
  temperature: number;
  systemPrompt: string;
  userMessageDescription: string;
  completionDescription: string;
}

/**
 * Returns the active formatter prompt configuration derived from registry defaults.
 * Used by settings UI to show exactly what the backend sends.
 */
export function getResearchFormatPromptView(): ResearchFormatPromptView {
  const model = resolveFormatModel(DEFAULT_FORMAT_MODEL_ID);

  return {
    modelId: model.id,
    modelLabel: model.label,
    apiModel: model.apiModel,
    providerLabel: RESEARCH_PROVIDERS[model.providerId].label,
    temperature: 0,
    systemPrompt: FORMAT_SYSTEM_PROMPT,
    userMessageDescription:
      "Preprocessed research markdown only (no extra instructions in the user message).",
    completionDescription:
      "OpenAI Responses API in background mode (same webhook and polling pattern as OpenAI research). Requires an OpenAI API key in Settings.",
  };
}
