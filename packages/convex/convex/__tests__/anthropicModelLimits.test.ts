import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAnthropicMaxOutputTokensCache,
  resolveAnthropicMaxOutputTokens,
} from "../providers/anthropicModelLimits";

describe("resolveAnthropicMaxOutputTokens", () => {
  beforeEach(() => {
    clearAnthropicMaxOutputTokensCache();
  });

  it("returns max_tokens from the Models API and caches subsequent lookups", async () => {
    let retrieveCalls = 0;
    const client = {
      models: {
        retrieve: async (modelId: string) => {
          retrieveCalls += 1;
          return {
            id: modelId,
            max_tokens: 128_000,
            type: "model" as const,
            display_name: "Claude Opus 4.8",
            created_at: "",
            capabilities: null,
            max_input_tokens: null,
          };
        },
      },
    };

    const first = await resolveAnthropicMaxOutputTokens(
      client as never,
      "claude-opus-4-8"
    );
    const second = await resolveAnthropicMaxOutputTokens(
      client as never,
      "claude-opus-4-8"
    );

    expect(first).toBe(128_000);
    expect(second).toBe(128_000);
    expect(retrieveCalls).toBe(1);
  });

  it("throws when the Models API omits max_tokens", async () => {
    const client = {
      models: {
        retrieve: async () => ({
          id: "claude-opus-4-8",
          max_tokens: null,
          type: "model" as const,
          display_name: "Claude Opus 4.8",
          created_at: "",
          capabilities: null,
          max_input_tokens: null,
        }),
      },
    };

    await expect(
      resolveAnthropicMaxOutputTokens(client as never, "claude-opus-4-8")
    ).rejects.toThrow(/did not report max_tokens/);
  });
});
