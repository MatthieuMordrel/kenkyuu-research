import { postpassResearchMarkdown } from "./researchFormatPrepass";

/** Minimum formatted/raw length ratio before rejecting output. */
const MIN_LENGTH_RATIO = 0.7;
/** Maximum formatted/raw length ratio before rejecting output. */
const MAX_LENGTH_RATIO = 1.35;
/** Max absolute difference in markdown link counts. */
const MAX_LINK_COUNT_DELTA = 5;

/** Max Anthropic format batches when guard checks fail. */
export const MAX_FORMAT_ATTEMPTS = 2;

/** Counts markdown links `[text](url)` for fidelity checks. */
export function countMarkdownLinks(markdown: string): number {
  const matches = markdown.match(/\[[^\]]*\]\([^)]+\)/g);
  return matches?.length ?? 0;
}

/**
 * Returns true when formatted output is plausibly the same report as raw.
 */
export function passesFormattingGuards(raw: string, formatted: string): boolean {
  const trimmed = formatted.trim();
  if (trimmed.length === 0) return false;

  const ratio = trimmed.length / Math.max(raw.length, 1);
  if (ratio < MIN_LENGTH_RATIO || ratio > MAX_LENGTH_RATIO) return false;

  const rawLinks = countMarkdownLinks(raw);
  const formattedLinks = countMarkdownLinks(formatted);
  if (Math.abs(formattedLinks - rawLinks) > MAX_LINK_COUNT_DELTA) {
    if (rawLinks > 0) {
      const relativeDelta = Math.abs(formattedLinks - rawLinks) / rawLinks;
      if (relativeDelta > 0.1) return false;
    } else if (formattedLinks > MAX_LINK_COUNT_DELTA) {
      return false;
    }
  }

  return true;
}

/**
 * Scales formatter max_tokens with input size, capped at the model maximum.
 */
export function maxOutputTokensForInput(
  inputLength: number,
  modelMaxOutputTokens: number
): number {
  const estimated = Math.ceil(inputLength * 0.55) + 2_048;
  return Math.min(modelMaxOutputTokens, Math.max(4_096, estimated));
}

export type FormatOutputDecision = "accept" | "retry" | "fallback";

/**
 * Decides how to proceed after a successful Anthropic batch returns formatted text.
 */
export function evaluateFormattedOutput(args: {
  preprocessed: string;
  formatted: string;
  formatAttempts: number;
}): { decision: FormatOutputDecision; text: string } {
  const { preprocessed, formatted, formatAttempts } = args;

  if (passesFormattingGuards(preprocessed, formatted)) {
    return { decision: "accept", text: formatted };
  }

  const batchesCompleted = formatAttempts + 1;
  if (batchesCompleted < MAX_FORMAT_ATTEMPTS) {
    return { decision: "retry", text: formatted };
  }

  return {
    decision: "fallback",
    text: postpassResearchMarkdown(formatted),
  };
}
