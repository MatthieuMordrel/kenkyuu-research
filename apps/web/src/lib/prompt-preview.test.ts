import { describe, expect, it } from "vitest";

import { extractVariables, injectVariables } from "./prompt-preview";

describe("injectVariables", () => {
  it("replaces every occurrence with provided values", () => {
    const result = injectVariables(
      "Analyze {{TICKER}} on {{DATE}}. Compare {{TICKER}} to {{STOCKS}}.",
      { ticker: "TSLA", stocks: "AAPL, MSFT", date: "June 10, 2026" }
    );
    expect(result).toBe(
      "Analyze TSLA on June 10, 2026. Compare TSLA to AAPL, MSFT."
    );
  });

  it("falls back to sample data when values are not provided", () => {
    expect(injectVariables("Report on {{TICKER}}")).toBe("Report on AAPL");
    expect(injectVariables("Cover {{STOCKS}}")).toBe(
      "Cover AAPL, MSFT, GOOGL, AMZN, NVDA"
    );
  });

  it("leaves templates without placeholders untouched", () => {
    expect(injectVariables("No variables here")).toBe("No variables here");
  });
});

describe("extractVariables", () => {
  it("returns unique variable names in order of first appearance", () => {
    expect(
      extractVariables("{{DATE}}: {{TICKER}} vs {{STOCKS}} ({{TICKER}})")
    ).toEqual(["DATE", "TICKER", "STOCKS"]);
  });

  it("ignores malformed placeholders", () => {
    expect(extractVariables("{TICKER} {{ SPACED }} {{}}")).toEqual([]);
  });

  it("returns an empty array for templates without variables", () => {
    expect(extractVariables("plain text")).toEqual([]);
  });
});
