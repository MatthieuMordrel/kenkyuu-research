import type { ResearchModelDefinition } from "@repo/research-models/types";
import type OpenAI from "openai";
import { RESEARCH_SYSTEM_PROMPT } from "@repo/research-models/research-prompt";

/** Responses create body including API fields not yet in all SDK typings. */
export type OpenAIResponseCreateBody =
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
