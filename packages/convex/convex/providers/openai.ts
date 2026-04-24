"use node";

import OpenAI from "openai";
import type { NormalizedUsage, ResearchProvider } from "./types";

const MODEL = "o3-deep-research";

// o3-deep-research pricing, USD per million tokens.
const INPUT_COST_PER_M = 10;
const OUTPUT_COST_PER_M = 40;

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

export const openaiProvider: ResearchProvider = {
  name: "openai",
  // OpenAI sends a Standard Webhook on completion, so we only poll as
  // a fallback for missed webhooks via the 15-min recovery cron.
  completionMode: "webhook",

  async start(prompt, apiKey) {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: MODEL,
      input: prompt,
      tools: [{ type: "web_search_preview" }],
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
          text: response.output_text,
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
export { estimateCost as estimateOpenAICost };
