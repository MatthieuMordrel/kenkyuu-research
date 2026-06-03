import { describe, expect, it } from "vitest";
import {
  fixInlineSectionTitles,
  keepSingleTopTitle,
  mergeDuplicateH2Sections,
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

describe("mergeDuplicateH2Sections", () => {
  it("merges two ## Executive Summary blocks", () => {
    const input =
      "## Executive Summary\n\nPart A.\n\n## Executive Summary\n\nPart B.";
    const out = mergeDuplicateH2Sections(input);
    expect(out).toContain("Part A.");
    expect(out).toContain("Part B.");
    expect(out.match(/^## Executive Summary/gm)?.length).toBe(1);
  });
});

describe("keepSingleTopTitle", () => {
  it("demotes duplicate document titles but keeps # Section N headings", () => {
    const input =
      "# Report Title\n\n# Duplicate Title\n\n# Section 1 — Business\n\n## Sub";
    expect(keepSingleTopTitle(input)).toBe(
      "# Report Title\n\n## Duplicate Title\n\n# Section 1 — Business\n\n## Sub"
    );
  });
});

describe("prepassResearchMarkdown", () => {
  it("applies multiple normalizations", () => {
    const input =
      " Model mechanics.** Foo.\r\n\r\n<thinking>x</thinking>\r\n\r\n\r\n\r\nBar";
    const out = prepassResearchMarkdown(input);
    expect(out).toContain("**Model mechanics:**");
    expect(out).not.toContain("<thinking>");
    expect(out).not.toMatch(/^ /m);
  });
});
