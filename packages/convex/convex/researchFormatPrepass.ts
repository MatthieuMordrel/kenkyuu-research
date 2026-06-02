/**
 * Deterministic markdown cleanup before/after the LLM formatting pass.
 * Fixes patterns models often miss when prompts stress "do not reword."
 */

/**
 * Turns inline pseudo-headings like `Model mechanics.** body` into ATX headings.
 */
/** Turns `Title.** body` into a bold lead-in (not a heading). */
export function fixInlineSectionTitles(markdown: string): string {
  return markdown.replace(
    /^([A-Za-z][^\n*]{2,90}?)\.\*\*\s+/gm,
    "**$1:** "
  );
}

/** Demotes ### headings that are only dates/quarters to bold lines. */
export function demoteShallowHeadings(markdown: string): string {
  return markdown.replace(
    /^#{1,3}\s+((?:Q[1-4]|FY)?\s*\d{4}[^#\n]{0,40}|(?:End of |As of )?(?:January|February|March|April|May|June|July|August|September|October|November|December)[^#\n]{0,40})\s*$/gim,
    "**$1**"
  );
}

/**
 * Removes stray leading spaces at line starts (common in model output).
 */
export function trimLeadingLineSpaces(markdown: string): string {
  return markdown.replace(/^ +\S/gm, (line) => line.trimStart());
}

/**
 * Joins orphaned em-dash line breaks into readable prose or list intros.
 */
export function fixOrphanEmDashBreaks(markdown: string): string {
  return markdown
    .replace(/ —\s*\n+\s*/g, " — ")
    .replace(/:\s*\n+\s*\n+([A-Z])/g, ":\n\n$1");
}

/**
 * Normalizes newlines and strips thinking blocks.
 */
export function normalizeNewlines(markdown: string): string {
  let text = markdown.replace(/\r\n/g, "\n").trim();
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/**
 * Full deterministic prepass applied before the LLM formatter.
 */
export function prepassResearchMarkdown(markdown: string): string {
  let text = normalizeNewlines(markdown);
  text = trimLeadingLineSpaces(text);
  text = fixInlineSectionTitles(text);
  text = fixOrphanEmDashBreaks(text);
  text = demoteShallowHeadings(text);
  return text.trim();
}

/** Target max characters per LLM formatting chunk (avoids action timeouts). */
export const FORMAT_CHUNK_TARGET_CHARS = 12_000;

/**
 * Splits a long report at ## headings into chunks sized for sequential formatting.
 */
export function splitMarkdownForFormatting(markdown: string): string[] {
  const preprocessed = prepassResearchMarkdown(markdown);
  if (preprocessed.length <= FORMAT_CHUNK_TARGET_CHARS) {
    return [preprocessed];
  }

  const parts = preprocessed.split(/(?=^## )/m);
  if (parts.length <= 1) {
    return [preprocessed];
  }

  const chunks: string[] = [];
  let buffer = "";

  for (const part of parts) {
    const next = buffer.length === 0 ? part : buffer + part;
    if (
      buffer.length > 0 &&
      next.length > FORMAT_CHUNK_TARGET_CHARS &&
      buffer.trim().length > 0
    ) {
      chunks.push(buffer.trim());
      buffer = part;
    } else {
      buffer = next;
    }
  }

  if (buffer.trim().length > 0) {
    chunks.push(buffer.trim());
  }

  return chunks.length > 0 ? chunks : [preprocessed];
}

/**
 * Light post-pass after the LLM (headings spacing, leftover title patterns).
 */
export function postpassResearchMarkdown(markdown: string): string {
  let text = prepassResearchMarkdown(markdown);
  text = demoteShallowHeadings(text);
  text = text.replace(/^(#{1,6}\s+.+)\n([^\n#])/gm, "$1\n\n$2");
  return text.trim();
}
