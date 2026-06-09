"use node";

import OpenAI from "openai";
import type { ResearchProviderAdapter } from "./types";
import { mapOpenAIResponseToPollResult } from "./openaiResponses";
import { buildOpenAIResponseCreateParams } from "./openai/buildOpenAIResponseCreateParams";
import { renderResearchMarkdown } from "./openai/renderResearchMarkdown";

export const openaiAdapter: ResearchProviderAdapter = {
  providerId: "openai",
  harnessId: "openai-responses",

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
