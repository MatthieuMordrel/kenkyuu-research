/**
 * Deterministic markdown cleanup before/after the LLM formatting pass.
 * Fixes patterns models often miss when prompts stress "do not reword."
 */

/**
 * Turns inline pseudo-headings like `Model mechanics.** body` into ATX headings.
 */
/** Turns `Title.** body` into a bold lead-in (not a heading). */
export function fixInlineSectionTitles(markdown: string): string {
  return markdown.replace(/^([A-Za-z][^\n*]{2,90}?)\.\*\*\s+/gm, "**$1:** ");
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

/**
 * Merges consecutive duplicate ## sections (can happen when the formatter repeats headings).
 */
/**
 * Keeps the first document # title; demotes duplicate document titles to ##.
 * Preserves `# Section N` main parts used by the research outline UI.
 */
export function keepSingleTopTitle(markdown: string): string {
  let seenDocumentTitle = false;
  return markdown.replace(/^# (.+)$/gm, (_line, title: string) => {
    if (/^Section \d+/.test(title)) {
      return `# ${title}`;
    }
    if (!seenDocumentTitle) {
      seenDocumentTitle = true;
      return `# ${title}`;
    }
    return `## ${title}`;
  });
}

export function mergeDuplicateH2Sections(markdown: string): string {
  const parts = markdown.split(/(?=^## )/m);
  if (parts.length <= 1) {
    return markdown;
  }

  const merged: string[] = [];
  const indexByTitle = new Map<string, number>();

  for (const part of parts) {
    const titleMatch = part.match(/^## (.+?)(?:\n|$)/);
    if (!titleMatch) {
      merged.push(part);
      continue;
    }

    const title = titleMatch[1].trim();
    const existing = indexByTitle.get(title);
    if (existing === undefined) {
      indexByTitle.set(title, merged.length);
      merged.push(part.trim());
      continue;
    }

    const body = part.replace(/^## .+?\n+/, "").trim();
    if (body) {
      merged[existing] = `${merged[existing]}\n\n${body}`.trim();
    }
  }

  return merged.join("\n\n").trim();
}

/**
 * Light post-pass after the LLM (headings spacing, leftover title patterns).
 */
export function postpassResearchMarkdown(markdown: string): string {
  let text = prepassResearchMarkdown(markdown);
  text = demoteShallowHeadings(text);
  text = keepSingleTopTitle(text);
  text = mergeDuplicateH2Sections(text);
  text = text.replace(/^(#{1,6}\s+.+)\n([^\n#])/gm, "$1\n\n$2");
  return text.trim();
}
