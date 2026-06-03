import { describe, expect, it } from "vitest";
import {
  buildResearchJobSearchText,
  extractResearchTitle,
} from "../researchJobSearchMetadata";

describe("extractResearchTitle", () => {
  it("returns the first H1 line", () => {
    const markdown = "# Apple Inc. Deep Dive\n\n## Summary\n\nBody text.";
    expect(extractResearchTitle(markdown)).toBe("Apple Inc. Deep Dive");
  });

  it("ignores later H1 headings", () => {
    const markdown = "# Primary Title\n\n## Section\n\n# Secondary";
    expect(extractResearchTitle(markdown)).toBe("Primary Title");
  });

  it("returns undefined when no H1 is present", () => {
    expect(extractResearchTitle("## Section only")).toBeUndefined();
  });
});

describe("buildResearchJobSearchText", () => {
  it("joins prompt, stocks, and title metadata", () => {
    expect(
      buildResearchJobSearchText({
        promptName: "Senior Equity Research Screen",
        stockTickers: ["AAPL", "MSFT"],
        stockNames: ["Apple Inc.", "Microsoft Corporation"],
        title: "Mega Cap Technology Review",
      })
    ).toBe(
      "Senior Equity Research Screen AAPL MSFT Apple Inc. Microsoft Corporation Mega Cap Technology Review"
    );
  });

  it("omits empty values", () => {
    expect(
      buildResearchJobSearchText({
        promptName: "Discovery",
        stockTickers: [],
        stockNames: [],
      })
    ).toBe("Discovery");
  });
});
