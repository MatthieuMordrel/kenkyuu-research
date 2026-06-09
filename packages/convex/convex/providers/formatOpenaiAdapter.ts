"use node";

import OpenAI from "openai";
import { FORMAT_SYSTEM_PROMPT } from "@repo/research-models/format-prompt";
import type { FormatModelDefinition } from "@repo/research-models/format-models";
import {
  extractPlainResponseText,
  mapOpenAIResponseToPollResult,
} from "./openaiResponses";
import type { PollResult } from "./types";

/** Responses create body for background format jobs (no tools). */
type FormatResponseCreateBody =
  OpenAI.Responses.ResponseCreateParamsNonStreaming;

/**
 * Builds OpenAI Responses API params for the post-research formatting pass.
 */
export function buildFormatResponseCreateParams(
  model: FormatModelDefinition,
  preprocessedMarkdown: string
): FormatResponseCreateBody {
  return {
    model: model.apiModel,
    instructions: FORMAT_SYSTEM_PROMPT,
    input: preprocessedMarkdown,
    background: true,
  };
}

/**
 * Submits a background format response; returns immediately with a pollable id.
 */
export async function startFormatResponse(
  model: FormatModelDefinition,
  apiKey: string,
  preprocessedMarkdown: string
): Promise<{ externalId: string }> {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create(
    buildFormatResponseCreateParams(model, preprocessedMarkdown)
  );
  return { externalId: response.id };
}

/**
 * Polls a background format response until completed, failed, or still running.
 */
export async function pollFormatResponse(
  apiKey: string,
  externalId: string
): Promise<PollResult> {
  const client = new OpenAI({ apiKey });
  const response = await client.responses.retrieve(externalId);
  return mapOpenAIResponseToPollResult(response, extractPlainResponseText);
}
