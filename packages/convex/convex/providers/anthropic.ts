"use node";

import Anthropic from "@anthropic-ai/sdk";
import type { ResearchProviderAdapter } from "./types";
import type { ResearchModelDefinition } from "@repo/research-models/types";
import { estimateModelCost } from "@repo/research-models/pricing";
import { RESEARCH_MODELS } from "@repo/research-models/models";
import { RESEARCH_SYSTEM_PROMPT } from "@repo/research-models/research-prompt";
import {
  extractAnthropicMessageText,
  findAnthropicBatchResult,
} from "../lib/anthropicBatchHelpers";
import { resolveAnthropicMaxOutputTokens } from "./anthropicModelLimits";

/** Map registry thinking type to Anthropic SDK thinking config. */
function buildThinkingConfig(
  thinkingType: NonNullable<ResearchModelDefinition["anthropic"]>["thinkingType"]
): Anthropic.Messages.MessageCreateParams["thinking"] {
  switch (thinkingType) {
    case "adaptive":
      return { type: "adaptive" };
    case "disabled":
      return { type: "disabled" };
    case "enabled":
      // Enabled mode requires an explicit budget; adaptive is preferred for research.
      return { type: "enabled", budget_tokens: 10_000 };
  }
}

/** Custom-id convention: every research batch contains exactly one request with this id. */
const RESEARCH_BATCH_REQUEST_ID = "research";

export const anthropicAdapter: ResearchProviderAdapter = {
  providerId: "anthropic",

  async start(model, prompt, apiKey) {
    const runtime = model.anthropic;
    if (!runtime) {
      throw new Error(`Missing anthropic runtime config for model ${model.id}`);
    }

    const client = new Anthropic({ apiKey });
    const maxTokens = await resolveAnthropicMaxOutputTokens(client, model.apiModel);
    const batch = await client.messages.batches.create({
      requests: [
        {
          custom_id: RESEARCH_BATCH_REQUEST_ID,
          params: {
            model: model.apiModel,
            max_tokens: maxTokens,
            thinking: buildThinkingConfig(runtime.thinkingType),
            output_config: { effort: runtime.effort },
            tools: [
              {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: runtime.webSearchMaxUses,
              },
            ],
            system: RESEARCH_SYSTEM_PROMPT,
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

    const result = await findAnthropicBatchResult(
      client,
      externalId,
      RESEARCH_BATCH_REQUEST_ID
    );
    if (!result) {
      return {
        status: "failed",
        error: "Batch ended but no result was returned",
      };
    }

    switch (result.result.type) {
      case "succeeded": {
        const message = result.result.message;
        const text = extractAnthropicMessageText(message.content);
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
