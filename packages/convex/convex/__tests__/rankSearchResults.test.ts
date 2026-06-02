import { describe, it, expect } from "vitest";
import { rankSearchResults } from "../lib/finnhub/rankSearchResults";
import type { FinnhubSearchResult } from "../lib/finnhub/types";

describe("rankSearchResults", () => {
  const rows: FinnhubSearchResult[] = [
    {
      description: "APPLE INC",
      displaySymbol: "AAPL",
      symbol: "AAPL",
      type: "Common Stock",
    },
    {
      description: "APPLE HOSPITALITY REIT INC",
      displaySymbol: "APLE",
      symbol: "APLE",
      type: "Common Stock",
    },
    {
      description: "APPLE INC WARRANT",
      displaySymbol: "AAPLW",
      symbol: "AAPLW",
      type: "Warrant",
    },
  ];

  it("prioritizes exact ticker matches and drops warrants", () => {
    const results = rankSearchResults(rows, "AAPL");
    expect(results).toHaveLength(2);
    expect(results[0]?.displaySymbol).toBe("AAPL");
    expect(results.some((r) => r.displaySymbol === "AAPLW")).toBe(false);
  });

  it("caps results at eight", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      description: `COMPANY ${i}`,
      displaySymbol: `SYM${i}`,
      symbol: `SYM${i}`,
      type: "Common Stock",
    }));
    expect(rankSearchResults(many, "SYM").length).toBe(8);
  });
});
