import { describe, expect, it } from "vitest";
import {
  fixInlineSectionTitles,
  prepassResearchMarkdown,
} from "../researchFormatPrepass";

describe("fixInlineSectionTitles", () => {
  it("converts Title.** prose into a bold lead-in", () => {
    const input =
      "Model mechanics.** Recurring/consumption + long-dated contracted capacity.";
    expect(fixInlineSectionTitles(input)).toBe(
      "**Model mechanics:** Recurring/consumption + long-dated contracted capacity."
    );
  });
});

describe("prepassResearchMarkdown", () => {
  it("applies multiple normalizations", () => {
    const input =
      " Model mechanics.** Foo.\r\n\r\n<thinking>x</thinking>\r\n\r\n\r\n\r\nBar";
    const out = prepassResearchMarkdown(input);
    expect(out).toContain("### Model mechanics");
    expect(out).not.toContain("<thinking>");
    expect(out).not.toMatch(/^ /m);
  });
});
