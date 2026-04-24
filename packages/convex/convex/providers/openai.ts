"use node";

import OpenAI from "openai";
import type {
  Response,
  ResponseOutputText,
} from "openai/resources/responses/responses";
import type { NormalizedUsage, ResearchProvider } from "./types";

const MODEL = "o3-deep-research";

// o3-deep-research pricing, USD per million tokens.
const INPUT_COST_PER_M = 10;
const OUTPUT_COST_PER_M = 40;

const RESEARCH_INSTRUCTIONS = `You are producing a publication-quality research report.

Return valid GitHub-flavored Markdown only.

Formatting rules:
- Use clear ATX headings with blank lines between sections.
- Use bullet lists for comparisons unless a table is clearly the best format.
- Only emit tables when every row has the same number of columns.
- Use fenced code blocks for code or command examples.
- Keep citations inline and preserve them next to the claims they support.

Research rules:
- Prioritize primary sources, company filings, official statements, regulators, and reputable financial reporting.
- Include specific figures, dates, and named evidence wherever available.
- Surface the strongest bull case, bear case, catalysts, and the main unresolved uncertainties.
- If evidence is mixed or incomplete, say so explicitly instead of smoothing over it.`;

function estimateCost(usage: NormalizedUsage): number {
  return (
    (usage.inputTokens * INPUT_COST_PER_M +
      usage.outputTokens * OUTPUT_COST_PER_M) /
    1_000_000
  );
}

function normalizeUsage(
  usage: OpenAI.Responses.ResponseUsage | undefined
): NormalizedUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

/**
 * Renders an OpenAI output-text part into markdown with clickable inline
 * citations and a deduplicated source appendix.
 */
function renderOutputTextWithCitations(
  part: Pick<ResponseOutputText, "annotations" | "text">
): string {
  const citations = part.annotations
    .filter(
      (
        annotation
      ): annotation is ResponseOutputText.URLCitation =>
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
      const [start, end] = key.split(":").map((value) => Number.parseInt(value, 10));
      return { start, end, citations: group };
    })
    .toSorted((left, right) => left.start - right.start || left.end - right.end);

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

/**
 * Extracts the final research report from a completed response while
 * preserving citation metadata exposed by the Responses API.
 */
function renderResearchMarkdown(response: Response): string {
  const markdownParts: string[] = [];

  for (const outputItem of response.output) {
    if (outputItem.type !== "message") {
      continue;
    }

    for (const contentPart of outputItem.content) {
      if (contentPart.type === "output_text") {
        markdownParts.push(renderOutputTextWithCitations(contentPart));
      }
    }
  }

  if (markdownParts.length > 0) {
    return markdownParts.join("\n\n").trim();
  }

  return response.output_text.trim();
}

export const openaiProvider: ResearchProvider = {
  name: "openai",
  // OpenAI sends a Standard Webhook on completion, so we only poll as
  // a fallback for missed webhooks via the 15-min recovery cron.
  completionMode: "webhook",

  async start(prompt, apiKey) {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: MODEL,
      instructions: RESEARCH_INSTRUCTIONS,
      input: prompt,
      reasoning: { summary: "auto" },
      tools: [
        { type: "web_search_preview" },
        { type: "code_interpreter", container: { type: "auto" } },
      ],
      background: true,
    });
    return { externalId: response.id };
  },

  async poll(externalId, apiKey) {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.retrieve(externalId);

    switch (response.status) {
      case "completed":
        return {
          status: "completed",
          text: renderResearchMarkdown(response),
          usage: normalizeUsage(response.usage),
        };
      case "failed":
        return {
          status: "failed",
          error: response.error?.message ?? "Research failed",
        };
      case "cancelled":
        return { status: "cancelled" };
      default:
        // "in_progress" | "queued" | null
        return { status: "running" };
    }
  },

  estimateCost,
};

/** @internal Exported for testing */
export {
  estimateCost as estimateOpenAICost,
  renderOutputTextWithCitations as renderOpenAITextWithCitations,
};
