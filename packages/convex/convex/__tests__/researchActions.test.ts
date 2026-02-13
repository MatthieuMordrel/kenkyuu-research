import { describe, it, expect } from "vitest";
import { estimateCost } from "../researchActions";

describe("estimateCost", () => {
  it("returns undefined for undefined usage", () => {
    expect(estimateCost(undefined)).toBeUndefined();
  });

  it("returns 0 for zero tokens", () => {
    const usage = {
      input_tokens: 0,
      output_tokens: 0,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 0,
    };
    expect(estimateCost(usage)).toBe(0);
  });

  it("calculates cost for input tokens only", () => {
    const usage = {
      input_tokens: 1_000_000,
      output_tokens: 0,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 1_000_000,
    };
    // 1M input tokens * $10/1M = $10
    expect(estimateCost(usage)).toBe(10);
  });

  it("calculates cost for output tokens only", () => {
    const usage = {
      input_tokens: 0,
      output_tokens: 1_000_000,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 1_000_000,
    };
    // 1M output tokens * $40/1M = $40
    expect(estimateCost(usage)).toBe(40);
  });

  it("calculates combined cost correctly", () => {
    const usage = {
      input_tokens: 500_000,
      output_tokens: 100_000,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 600_000,
    };
    // 500K * $10/1M + 100K * $40/1M = $5 + $4 = $9
    expect(estimateCost(usage)).toBe(9);
  });

  it("handles small token counts", () => {
    const usage = {
      input_tokens: 1000,
      output_tokens: 500,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 1500,
    };
    // 1000 * 10 / 1M + 500 * 40 / 1M = 0.01 + 0.02 = 0.03
    expect(estimateCost(usage)).toBeCloseTo(0.03, 10);
  });
});
