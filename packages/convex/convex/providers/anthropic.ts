"use node";

import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageBatchIndividualResponse,
  TextBlock,
} from "@anthropic-ai/sdk/resources/messages";
import type { NormalizedUsage, ResearchProvider } from "./types";

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 16_000;
const THINKING_BUDGET_TOKENS = 16_000;
const WEB_SEARCH_MAX_USES = 40;

// Batch API pricing for Claude Opus 4.7 (50% discount vs on-demand), USD/MTok.
const INPUT_COST_PER_M = 2.5;
const OUTPUT_COST_PER_M = 12.5;
// Web search add-on: $10 per 1,000 searches (not discounted by batch).
const WEB_SEARCH_COST_PER_CALL = 0.01;

/** Custom-id convention: every batch contains exactly one request with this id. */
const REQUEST_ID = "research";

function estimateCost(usage: NormalizedUsage): number {
  const tokenCost =
    (usage.inputTokens * INPUT_COST_PER_M +
      usage.outputTokens * OUTPUT_COST_PER_M) /
    1_000_000;
  const searchCost = (usage.webSearchRequests ?? 0) * WEB_SEARCH_COST_PER_CALL;
  return tokenCost + searchCost;
}

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

export const anthropicProvider: ResearchProvider = {
  name: "anthropic",
  // Anthropic has no completion webhook — we must poll batches until they end.
  completionMode: "polling",

  async start(prompt, apiKey) {
    const client = new Anthropic({ apiKey });
    const batch = await client.messages.batches.create({
      requests: [
        {
          custom_id: REQUEST_ID,
          params: {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            thinking: {
              type: "enabled",
              budget_tokens: THINKING_BUDGET_TOKENS,
            },
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

  async poll(externalId, apiKey) {
    const client = new Anthropic({ apiKey });
    const batch = await client.messages.batches.retrieve(externalId);

    if (batch.processing_status !== "ended") {
      // "in_progress" | "canceling"
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

  estimateCost,
};

/** @internal Exported for testing */
export { estimateCost as estimateAnthropicCost };
