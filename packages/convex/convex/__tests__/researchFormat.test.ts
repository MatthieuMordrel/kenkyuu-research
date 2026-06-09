import { describe, expect, it } from "vitest";
import {
  countH1Headings,
  countMarkdownLinks,
  countTopLevelMainSections,
  evaluateFormattedOutput,
  maxOutputTokensForInput,
  passesFormattingGuards,
  passesHeadingStructureGuard,
  MAX_FORMAT_ATTEMPTS,
} from "../researchFormatCore";
import { prepassResearchMarkdown } from "../researchFormatPrepass";
import { prepassMarkdown } from "../researchFormat";

describe("prepassMarkdown", () => {
  it("strips thinking blocks and normalizes blank lines", () => {
    const input =
      "Hello\r\n\r\n<thinking>secret</thinking>\r\n\r\n\r\n\r\n\r\nWorld";
    expect(prepassMarkdown(input)).toBe("Hello\n\nWorld");
  });

  it("fixes inline section titles via prepass module", () => {
    const input = "Model mechanics.** Recurring capacity.";
    expect(prepassResearchMarkdown(input)).toContain("**Model mechanics:**");
  });
});

describe("countMarkdownLinks", () => {
  it("counts inline markdown links", () => {
    const text = "See [A](https://a.com) and [B](https://b.com).";
    expect(countMarkdownLinks(text)).toBe(2);
  });
});

describe("maxOutputTokensForInput", () => {
  it("scales with input length and caps at the model maximum", () => {
    const modelMax = 64_000;
    expect(maxOutputTokensForInput(10_000, modelMax)).toBeGreaterThan(4_096);
    expect(maxOutputTokensForInput(400_000, modelMax)).toBe(modelMax);
  });
});

describe("heading structure helpers", () => {
  const deepResearchSkeleton =
    "# ACMR Deep Research\n\n## Bottom line first\n\n" +
    "# Section 0 — Data\n\n## 0.1 Identity\n\n" +
    "# Section 1 — Business\n\n## What it sells\n\n";

  it("counts top-level main sections and H1 headings", () => {
    expect(countTopLevelMainSections(deepResearchSkeleton)).toBe(2);
    expect(countH1Headings(deepResearchSkeleton)).toBe(3);
  });

  it("rejects when formatter flattens # Section headings to ##", () => {
    const flattened =
      "# ACMR Deep Research\n\n## Bottom line first\n\n" +
      "## Section 0 — Data\n\n## Section 1 — Business\n\n## What it sells\n\n";
    expect(passesHeadingStructureGuard(deepResearchSkeleton, flattened)).toBe(
      false
    );
    expect(passesFormattingGuards(deepResearchSkeleton, flattened)).toBe(false);
  });

  it("accepts polish that preserves the section ladder", () => {
    const polished = deepResearchSkeleton.replace(
      "## What it sells",
      "## What it sells\n\n"
    );
    expect(passesHeadingStructureGuard(deepResearchSkeleton, polished)).toBe(
      true
    );
  });
});

describe("passesFormattingGuards", () => {
  it("accepts well-formed output with similar length and links", () => {
    const raw =
      "# Title\n\nClaim [1](https://x.com).\n\n## Sources\n1. [X](https://x.com)";
    const formatted =
      "# Title\n\nClaim [1](https://x.com).\n\n## Sources\n\n1. [X](https://x.com)";
    expect(passesFormattingGuards(raw, formatted)).toBe(true);
  });

  it("rejects empty output", () => {
    expect(passesFormattingGuards("hello", "   ")).toBe(false);
  });

  it("rejects drastic length shrink", () => {
    const raw = "a".repeat(1000);
    expect(passesFormattingGuards(raw, "short")).toBe(false);
  });
});

describe("evaluateFormattedOutput", () => {
  const preprocessed = "a".repeat(1000);
  const formatted = "a".repeat(1000);

  it("accepts output that passes guards", () => {
    expect(
      evaluateFormattedOutput({
        preprocessed,
        formatted,
        formatAttempts: 0,
      }).decision
    ).toBe("accept");
  });

  it("retries after first guard failure when under max attempts", () => {
    expect(
      evaluateFormattedOutput({
        preprocessed,
        formatted: "short",
        formatAttempts: 0,
      }).decision
    ).toBe("retry");
  });

  it("falls back after exhausting format attempts", () => {
    const result = evaluateFormattedOutput({
      preprocessed,
      formatted: "short",
      formatAttempts: MAX_FORMAT_ATTEMPTS - 1,
    });
    expect(result.decision).toBe("fallback");
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("falls back to preprocessed outline when formatter flattens main sections", () => {
    const outlinePreprocessed =
      "# ZETA Deep Research\n\n**Bottom line:** Hold.\n\n" +
      "# Section 1 — Business\n\n## Model mechanics\n\n" +
      "Revenue is usage-based.\n\n".repeat(80);
    const flattened =
      "# ZETA Deep Research\n\n## Bottom line\n\n## Section 1 — Business\n\n" +
      "## Model mechanics\n\nRevenue is usage-based.\n\n".repeat(80);

    const result = evaluateFormattedOutput({
      preprocessed: outlinePreprocessed,
      formatted: flattened,
      formatAttempts: MAX_FORMAT_ATTEMPTS - 1,
    });

    expect(result.decision).toBe("fallback");
    expect(countTopLevelMainSections(result.text)).toBe(1);
    expect(result.text).toContain("# Section 1 — Business");
    expect(result.text).not.toContain("## Section 1 — Business");
  });
});
