"use node";

import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageBatchIndividualResponse,
  TextBlock,
} from "@anthropic-ai/sdk/resources/messages";
import type { ResearchProviderAdapter } from "./types";
import { estimateModelCost } from "@repo/research-models/pricing";
import { RESEARCH_MODELS } from "@repo/research-models/models";

// At xhigh effort the docs recommend ~64k so the model has room to think and
// run repeated tool calls across a long research turn.
const MAX_TOKENS = 64_000;
const EFFORT = "xhigh" as const;
const WEB_SEARCH_MAX_USES = 40;

/** Custom-id convention: every batch contains exactly one request with this id. */
const REQUEST_ID = "research";

/** Concatenate every text block in a Claude message into a single string. */
function extractText(content: readonly unknown[]): string {
  return content
    .filter((b): b is TextBlock => (b as { type?: string }).type === "text")
    .map((b) => b.text)
    .join("\n\n");
}

async function findResult(
  client: Anthropic,
  batchId: string
): Promise<MessageBatchIndividualResponse | undefined> {
  for await (const result of await client.messages.batches.results(batchId)) {
    if (result.custom_id === REQUEST_ID) return result;
  }
  return undefined;
}

export const anthropicAdapter: ResearchProviderAdapter = {
  providerId: "anthropic",

  async start(model, prompt, apiKey) {
    const client = new Anthropic({ apiKey });
    const batch = await client.messages.batches.create({
      requests: [
        {
          custom_id: REQUEST_ID,
          params: {
            model: model.apiModel,
            max_tokens: MAX_TOKENS,
            // Opus 4.8 supports adaptive thinking; depth is steered by effort.
            thinking: { type: "adaptive" },
            output_config: { effort: EFFORT },
            tools: [
              {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: WEB_SEARCH_MAX_USES,
              },
            ],
            messages: [{ role: "user", content: prompt }],
          },
        },
      ],
    });
    return { externalId: batch.id };
  },

  async poll(model, externalId, apiKey) {
    void model;
    const client = new Anthropic({ apiKey });
    const batch = await client.messages.batches.retrieve(externalId);

    if (batch.processing_status !== "ended") {
      return { status: "running" };
    }

    const result = await findResult(client, externalId);
    if (!result) {
      return {
        status: "failed",
        error: "Batch ended but no result was returned",
      };
    }

    switch (result.result.type) {
      case "succeeded": {
        const message = result.result.message;
        const text = extractText(message.content);
        return {
          status: "completed",
          text,
          usage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            webSearchRequests:
              message.usage.server_tool_use?.web_search_requests ?? 0,
          },
        };
      }
      case "errored":
        return {
          status: "failed",
          error: result.result.error.error.message,
        };
      case "canceled":
        return { status: "cancelled" };
      case "expired":
        return {
          status: "failed",
          error: "Batch expired before processing",
        };
    }
  },
};

/** @deprecated Use anthropicAdapter */
export const anthropicProvider = anthropicAdapter;

/** @internal Exported for testing — uses opus registry pricing */
export function estimateAnthropicCost(usage: import("./types").NormalizedUsage): number {
  return estimateModelCost(RESEARCH_MODELS["anthropic/claude-opus-4-8"], usage);
}
