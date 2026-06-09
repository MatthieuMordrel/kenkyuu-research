import type { ResponseOutputText } from "openai/resources/responses/responses";

/**
 * Renders an OpenAI output-text part into markdown with clickable inline
 * citations and a deduplicated source appendix.
 */
export function renderOutputTextWithCitations(
  part: Pick<ResponseOutputText, "annotations" | "text">
): string {
  const citations = part.annotations
    .filter(
      (annotation): annotation is ResponseOutputText.URLCitation =>
        annotation.type === "url_citation"
    )
    .filter(
      (annotation) =>
        annotation.start_index >= 0 &&
        annotation.end_index > annotation.start_index &&
        annotation.end_index <= part.text.length
    );

  if (citations.length === 0) {
    return part.text.trim();
  }

  const grouped = new Map<string, ResponseOutputText.URLCitation[]>();
  for (const citation of citations) {
    const key = `${citation.start_index}:${citation.end_index}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(citation);
    } else {
      grouped.set(key, [citation]);
    }
  }

  const ranges = Array.from(grouped.entries())
    .map(([key, group]) => {
      const [start, end] = key
        .split(":")
        .map((value) => Number.parseInt(value, 10));
      return { start, end, citations: group };
    })
    .toSorted(
      (left, right) => left.start - right.start || left.end - right.end
    );

  let cursor = 0;
  const rendered: string[] = [];

  for (const range of ranges) {
    if (range.start < cursor || range.end > part.text.length) {
      continue;
    }

    const segment = part.text.slice(cursor, range.end);
    const trimmedSegment = segment.trimEnd();
    const trailingWhitespace = segment.slice(trimmedSegment.length);

    rendered.push(trimmedSegment);
    rendered.push(
      `${trimmedSegment.endsWith(" ") ? "" : " "}${range.citations
        .map((citation, index) => `[${index + 1}](${citation.url})`)
        .join(" ")}`
    );
    rendered.push(trailingWhitespace);
    cursor = range.end;
  }

  rendered.push(part.text.slice(cursor));

  const uniqueSources = new Map<string, string>();
  for (const citation of citations) {
    uniqueSources.set(citation.url, citation.title.trim() || citation.url);
  }

  const sourceList = Array.from(uniqueSources.entries()).map(
    ([url, title], index) => `${index + 1}. [${title}](${url})`
  );

  return `${rendered.join("").trim()}\n\n## Sources\n${sourceList.join("\n")}`;
}
