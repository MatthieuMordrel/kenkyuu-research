import {
  DEFAULT_FORMAT_MODEL_ID,
  resolveFormatModel,
  type FormatModelId,
} from "./format-models";
import { RESEARCH_PROVIDERS } from "./providers";

/**
 * System prompt sent to the formatter model after research completes.
 * Controls outline structure, readability, and fidelity rules.
 */
export const FORMAT_SYSTEM_PROMPT = `You are a publication-quality markdown editor for institutional equity research. The report renders in a web app where only ## headings become collapsible sections. Everything collapsed by default except the reader expands a few major parts — so structure must be disciplined.

## Outline rules (critical)

- Exactly ONE # title at the top (company / report name). Do not repeat the company name as ## later.
- Use ## only for major parts (about 6–12 for a long report): e.g. Executive summary, Investment thesis, Business model, Financials & KPIs, Competitive landscape, Risks, Valuation, Data verification (if needed), Sources.
- Do NOT use ## for: numbered stubs ("Section 1", "Section 2"), quarters (Q1 2026, Q4 2025), single months, one-line facts, or duplicate company titles.
- Use ### sparingly — only when a subsection has several paragraphs or a substantial bullet list beneath it.
- Dates, quarters, and short labels (Q1 2026, December 2025, End 2025) must be **bold lead-ins** or bullet items, NEVER ### or ## headings.
- Merge redundant blocks: one "Nebius Group" chapter with Section 1/2/3 content nested as ### or bold sub-parts under a single ##, not multiple duplicate ## company headers.
- Remove empty "Data verification" style headers unless they contain real content; fold verification notes into bullets under Financials.

## Readability

- NEVER leave "Label.** sentence" blobs — use **Label:** or ### Label (only if enough body text follows).
- Clusters of metrics → bullet lists. Verbatim quotes → blockquotes (> …).
- One idea per paragraph; fix hard line breaks and dangling em dashes.

## Example

BAD: ## Nebius Group / ## Data verification / ## Section 1 / ### Q1 2026 / ### December 2025 (one line each)
GOOD: ## Business model & unit economics with **Q1 2026:** and **FY2025:** as bold bullets inside the section

## Fidelity

- Keep all numbers, dates, tickers, and claims exact. Preserve citations and ## Sources.
- Output GitHub-flavored Markdown only — no preamble or wrapper fences.`;

/** Extra system instructions when formatting a long report in multiple chunks. */
export const FORMAT_FRAGMENT_SYSTEM_APPENDIX = `

## Fragment mode (this chunk is part of a longer report)

- Do NOT add a new # title or invent ## sections that are not already in this chunk.
- Keep existing ## headings in this chunk; only add ### / bold / bullets / blockquotes.
- Do not start with Executive Summary unless that heading is already at the top of this chunk.`;

/**
 * User message instructions for a single-chunk report (typical case).
 */
export const FORMAT_USER_MESSAGE_INSTRUCTIONS = `Rewrite for readability. ONE # title, ~6-12 ## major sections total (no ## for quarters/dates/section numbers). **Bold** for Q1 2026 labels. No duplicate company ## headers. Preserve all facts. Markdown only.`;

/** User message instructions for the first chunk of a long report. */
export const FORMAT_FRAGMENT_FIRST_USER_INSTRUCTIONS =
  "FIRST fragment: you may keep or refine ## headings that already appear here, but do not invent a full duplicate outline.";

/** User message instructions for middle and last chunks of a long report. */
export const FORMAT_FRAGMENT_MIDDLE_USER_INSTRUCTIONS =
  "MIDDLE/LAST fragment: do NOT add # or new ## section titles. Only ###, **bold**, lists, blockquotes.";

/** Separator between instructions and research markdown in the formatter user message. */
export const FORMAT_USER_MESSAGE_SEPARATOR = "\n\n---\n\n";

/**
 * Read-only snapshot of the post-research formatting pipeline for UI display.
 * @property modelId - Registry id used for cost logs
 * @property modelLabel - Human-readable model name
 * @property apiModel - Provider API model string
 * @property providerLabel - Vendor display name
 * @property temperature - Sampling temperature for formatter calls
 * @property systemPrompt - System message for single-chunk reports
 * @property fragmentSystemPrompt - System message for multi-chunk reports
 * @property userMessageInstructions - User message prefix for single-chunk reports
 * @property fragmentFirstUserInstructions - User message prefix for the first chunk
 * @property fragmentMiddleUserInstructions - User message prefix for later chunks
 */
export interface ResearchFormatPromptView {
  modelId: FormatModelId;
  modelLabel: string;
  apiModel: string;
  providerLabel: string;
  temperature: number;
  systemPrompt: string;
  fragmentSystemPrompt: string;
  userMessageInstructions: string;
  fragmentFirstUserInstructions: string;
  fragmentMiddleUserInstructions: string;
}

/**
 * Returns the system prompt for a formatting pass.
 *
 * @param chunkTotal - Number of markdown chunks in this pass
 */
export function getFormatSystemPrompt(chunkTotal: number): string {
  if (chunkTotal > 1) {
    return `${FORMAT_SYSTEM_PROMPT}${FORMAT_FRAGMENT_SYSTEM_APPENDIX}`;
  }
  return FORMAT_SYSTEM_PROMPT;
}

/**
 * Builds the user message content for one formatting chunk.
 *
 * @param researchMarkdown - Preprocessed research output to polish
 * @param chunkIndex - Zero-based index of the current chunk
 * @param chunkTotal - Total number of chunks in this pass
 */
export function buildFormatUserMessageForChunk(
  researchMarkdown: string,
  chunkIndex: number,
  chunkTotal: number
): string {
  if (chunkTotal === 1) {
    return `${FORMAT_USER_MESSAGE_INSTRUCTIONS}${FORMAT_USER_MESSAGE_SEPARATOR}${researchMarkdown}`;
  }

  const role =
    chunkIndex === 0
      ? FORMAT_FRAGMENT_FIRST_USER_INSTRUCTIONS
      : FORMAT_FRAGMENT_MIDDLE_USER_INSTRUCTIONS;

  return `${role}${FORMAT_USER_MESSAGE_SEPARATOR}${researchMarkdown}`;
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
    fragmentSystemPrompt: getFormatSystemPrompt(2),
    userMessageInstructions: FORMAT_USER_MESSAGE_INSTRUCTIONS,
    fragmentFirstUserInstructions: FORMAT_FRAGMENT_FIRST_USER_INSTRUCTIONS,
    fragmentMiddleUserInstructions: FORMAT_FRAGMENT_MIDDLE_USER_INSTRUCTIONS,
  };
}
