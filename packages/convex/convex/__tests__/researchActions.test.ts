import { describe, expect, it } from "vitest";
import { estimateAnthropicCost } from "../providers/anthropic";
import { estimateOpenAICost } from "../providers/openai";

describe("openai estimateCost", () => {
  it("returns 0 for zero tokens", () => {
    expect(estimateOpenAICost({ inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("prices input at $10 / M", () => {
    expect(
      estimateOpenAICost({ inputTokens: 1_000_000, outputTokens: 0 })
    ).toBe(10);
  });

  it("prices output at $40 / M", () => {
    expect(
      estimateOpenAICost({ inputTokens: 0, outputTokens: 1_000_000 })
    ).toBe(40);
  });

  it("combines input and output costs", () => {
    // 500K input * $10/M + 100K output * $40/M = $5 + $4 = $9
    expect(
      estimateOpenAICost({ inputTokens: 500_000, outputTokens: 100_000 })
    ).toBe(9);
  });

  it("handles small token counts with floating-point precision", () => {
    // 1000 * 10 / 1M + 500 * 40 / 1M = 0.01 + 0.02 = 0.03
    expect(
      estimateOpenAICost({ inputTokens: 1000, outputTokens: 500 })
    ).toBeCloseTo(0.03, 10);
  });
});

describe("anthropic estimateCost", () => {
  it("returns 0 for empty usage", () => {
    expect(estimateAnthropicCost({ inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("prices input at $2.50 / M (batch rate)", () => {
    expect(
      estimateAnthropicCost({ inputTokens: 1_000_000, outputTokens: 0 })
    ).toBe(2.5);
  });

  it("prices output at $12.50 / M (batch rate)", () => {
    expect(
      estimateAnthropicCost({ inputTokens: 0, outputTokens: 1_000_000 })
    ).toBe(12.5);
  });

  it("adds $0.01 per web search request", () => {
    // 0 tokens + 5 searches * $0.01 = $0.05
    expect(
      estimateAnthropicCost({
        inputTokens: 0,
        outputTokens: 0,
        webSearchRequests: 5,
      })
    ).toBeCloseTo(0.05, 10);
  });

  it("combines tokens and searches", () => {
    // 100K input * $2.50/M + 50K output * $12.50/M + 10 searches * $0.01
    // = 0.25 + 0.625 + 0.10 = 0.975
    expect(
      estimateAnthropicCost({
        inputTokens: 100_000,
        outputTokens: 50_000,
        webSearchRequests: 10,
      })
    ).toBeCloseTo(0.975, 10);
  });
});
