"use node";

import type Anthropic from "@anthropic-ai/sdk";
import type {
  MessageBatchIndividualResponse,
  TextBlock,
} from "@anthropic-ai/sdk/resources/messages";

/**
 * Finds a single batch result by custom_id (one request per batch in this app).
 */
export async function findAnthropicBatchResult(
  client: Anthropic,
  batchId: string,
  customId: string
): Promise<MessageBatchIndividualResponse | undefined> {
  for await (const result of await client.messages.batches.results(batchId)) {
    if (result.custom_id === customId) return result;
  }
  return undefined;
}

/** Concatenates text blocks from a Claude message into one string. */
export function extractAnthropicMessageText(content: readonly unknown[]): string {
  return content
    .filter((block): block is TextBlock => (block as { type?: string }).type === "text")
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}
