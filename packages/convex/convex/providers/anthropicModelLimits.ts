"use node";

import type Anthropic from "@anthropic-ai/sdk";

/** Process-local cache: apiModel → max output tokens from the Models API. */
const maxOutputTokensByApiModel = new Map<string, number>();

/**
 * Resolves the largest allowed `max_tokens` for an Anthropic model via the Models API.
 * Results are cached for the lifetime of the Convex runtime instance.
 *
 * @param client - Authenticated Anthropic client
 * @param apiModel - Provider model id (e.g. `claude-opus-4-8`)
 * @returns Maximum output tokens permitted for the model
 */
export async function resolveAnthropicMaxOutputTokens(
  client: Anthropic,
  apiModel: string
): Promise<number> {
  const cached = maxOutputTokensByApiModel.get(apiModel);
  if (cached !== undefined) {
    return cached;
  }

  const info = await client.models.retrieve(apiModel);
  const maxTokens = info.max_tokens;
  if (maxTokens === null || maxTokens <= 0) {
    throw new Error(
      `Anthropic model ${apiModel} did not report max_tokens; cannot set output limit`
    );
  }

  maxOutputTokensByApiModel.set(apiModel, maxTokens);
  return maxTokens;
}

/** Clears the in-memory cache (for tests only). */
export function clearAnthropicMaxOutputTokensCache(): void {
  maxOutputTokensByApiModel.clear();
}
