import { describe, expect, it } from "vitest";
import { estimateAnthropicCost } from "../providers/anthropic";
import {
  buildOpenAIResponseCreateParams,
  estimateOpenAICost,
  renderOpenAITextWithCitations,
} from "../providers/openai";
import { RESEARCH_MODELS } from "@repo/research-models/models";

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

describe("buildOpenAIResponseCreateParams", () => {
  it("configures GPT-5.5 for deep research with xhigh effort and high tool budget", () => {
    const params = buildOpenAIResponseCreateParams(
      RESEARCH_MODELS["openai/gpt-5.5"],
      "Analyze AAPL"
    );

    expect(params.model).toBe("gpt-5.5");
    expect(params.reasoning).toEqual({ effort: "xhigh", summary: "auto" });
    expect(params.max_tool_calls).toBe(150);
    expect(params.max_output_tokens).toBe(128_000);
    expect(params.tools).toEqual([
      { type: "web_search", search_context_size: "high" },
      { type: "code_interpreter", container: { type: "auto" } },
    ]);
    expect(params.background).toBe(true);
  });

  it("keeps legacy defaults for o3 deep research", () => {
    const params = buildOpenAIResponseCreateParams(
      RESEARCH_MODELS["openai/o3-deep-research"],
      "Analyze AAPL"
    );

    expect(params.reasoning).toEqual({ summary: "auto" });
    expect(params.max_tool_calls).toBeUndefined();
    expect(params.tools).toEqual([
      { type: "web_search_preview" },
      { type: "code_interpreter", container: { type: "auto" } },
    ]);
  });
});

describe("renderOpenAITextWithCitations", () => {
  it("preserves plain text when no citations are present", () => {
    expect(
      renderOpenAITextWithCitations({ text: "Plain report body", annotations: [] })
    ).toBe("Plain report body");
  });

  it("adds inline markdown links and a sources appendix", () => {
    const rendered = renderOpenAITextWithCitations({
      text: "Revenue accelerated meaningfully in 2025.",
      annotations: [
        {
          type: "url_citation",
          title: "Company Filing",
          url: "https://example.com/filing",
          start_index: 8,
          end_index: 33,
        },
      ],
    });

    expect(rendered).toContain(
      "accelerated meaningfully [1](https://example.com/filing) in 2025."
    );
    expect(rendered).toContain("## Sources");
    expect(rendered).toContain("1. [Company Filing](https://example.com/filing)");
  });

  it("deduplicates repeated sources in the appendix", () => {
    const rendered = renderOpenAITextWithCitations({
      text: "Claim one. Claim two.",
      annotations: [
        {
          type: "url_citation",
          title: "Same Source",
          url: "https://example.com/source",
          start_index: 0,
          end_index: 5,
        },
        {
          type: "url_citation",
          title: "Same Source",
          url: "https://example.com/source",
          start_index: 11,
          end_index: 16,
        },
      ],
    });

    expect(rendered.match(/https:\/\/example\.com\/source/g)?.length).toBe(3);
    expect(rendered).toContain("1. [Same Source](https://example.com/source)");
  });
});
