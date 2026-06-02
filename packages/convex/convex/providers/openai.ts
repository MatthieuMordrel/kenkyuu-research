"use node";

import type { ResearchModelDefinition } from "@repo/research-models/types";
import OpenAI from "openai";
import type {
  Response,
  ResponseOutputText,
} from "openai/resources/responses/responses";
import type { ResearchProviderAdapter } from "./types";
import { estimateModelCost } from "@repo/research-models/pricing";
import { RESEARCH_MODELS } from "@repo/research-models/models";
import { RESEARCH_SYSTEM_PROMPT } from "@repo/research-models/research-prompt";
import { mapOpenAIResponseToPollResult } from "./openaiResponses";

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

/** Responses create body including API fields not yet in all SDK typings. */
type OpenAIResponseCreateBody =
  OpenAI.Responses.ResponseCreateParamsNonStreaming & {
    max_tool_calls?: number;
  };

/**
 * Build Responses API create params from registry metadata.
 * Legacy models without `openai` runtime config keep the original defaults.
 */
export function buildOpenAIResponseCreateParams(
  model: ResearchModelDefinition,
  prompt: string
): OpenAIResponseCreateBody {
  const runtime = model.openai;
  const webSearchTool = runtime?.webSearchTool ?? "web_search_preview";

  const tools: OpenAI.Responses.ResponseCreateParamsNonStreaming["tools"] =
    webSearchTool === "web_search"
      ? [
          {
            type: "web_search",
            search_context_size: runtime?.webSearchContextSize ?? "medium",
          },
        ]
      : [{ type: "web_search_preview" }];

  tools.push({ type: "code_interpreter", container: { type: "auto" } });

  return {
    model: model.apiModel,
    instructions: RESEARCH_SYSTEM_PROMPT,
    input: prompt,
    reasoning: runtime
      ? { effort: runtime.reasoningEffort, summary: "auto" }
      : { summary: "auto" },
    max_tool_calls: runtime?.maxToolCalls,
    max_output_tokens: runtime?.maxOutputTokens,
    tools,
    background: true,
  };
}

export const openaiAdapter: ResearchProviderAdapter = {
  providerId: "openai",

  async start(model, prompt, apiKey) {
    const client = new OpenAI({ apiKey });
    const body = buildOpenAIResponseCreateParams(model, prompt);
    // max_tool_calls is supported by the API; SDK typings may lag behind.
    const response = await client.responses.create(
      body as OpenAI.Responses.ResponseCreateParamsNonStreaming
    );
    return { externalId: response.id };
  },

  async poll(model, externalId, apiKey) {
    void model;
    const client = new OpenAI({ apiKey });
    const response = await client.responses.retrieve(externalId);
    return mapOpenAIResponseToPollResult(response, renderResearchMarkdown);
  },
};

/** @deprecated Use openaiAdapter */
export const openaiProvider = openaiAdapter;

/** @internal Exported for testing — uses o3-deep-research registry pricing */
export function estimateOpenAICost(
  usage: import("./types").NormalizedUsage
): number {
  return estimateModelCost(RESEARCH_MODELS["openai/o3-deep-research"], usage);
}

/** @internal Exported for testing */
export { renderOutputTextWithCitations as renderOpenAITextWithCitations };
