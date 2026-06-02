"use node";

import type OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import type { NormalizedUsage, PollResult } from "./types";

/**
 * Maps OpenAI Responses usage to the shared normalized shape.
 */
export function normalizeOpenAIUsage(
  usage: OpenAI.Responses.ResponseUsage | undefined
): NormalizedUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

/**
 * Extracts plain text from a completed Responses payload (no citation rewriting).
 */
export function extractPlainResponseText(response: Response): string {
  const parts: string[] = [];

  for (const outputItem of response.output) {
    if (outputItem.type !== "message") {
      continue;
    }
    for (const contentPart of outputItem.content) {
      if (contentPart.type === "output_text") {
        parts.push(contentPart.text.trim());
      }
    }
  }

  if (parts.length > 0) {
    return parts.join("\n\n").trim();
  }

  return response.output_text.trim();
}

/**
 * Converts an OpenAI Responses retrieve payload into a provider-agnostic poll result.
 */
export function mapOpenAIResponseToPollResult(
  response: Response,
  extractText: (response: Response) => string
): PollResult {
  switch (response.status) {
    case "completed": {
      const text = extractText(response);
      if (!text) {
        return { status: "failed", error: "OpenAI response returned no text" };
      }
      return {
        status: "completed",
        text,
        usage: normalizeOpenAIUsage(response.usage),
      };
    }
    case "failed":
      return {
        status: "failed",
        error: response.error?.message ?? "OpenAI response failed",
      };
    case "cancelled":
      return { status: "cancelled" };
    default:
      return { status: "running" };
  }
}
