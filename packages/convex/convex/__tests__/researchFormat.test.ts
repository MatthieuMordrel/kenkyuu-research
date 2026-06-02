import { describe, expect, it } from "vitest";
import {
  countMarkdownLinks,
  evaluateFormattedOutput,
  maxOutputTokensForInput,
  passesFormattingGuards,
  MAX_FORMAT_ATTEMPTS,
} from "../researchFormatCore";
import { prepassResearchMarkdown } from "../researchFormatPrepass";
import { prepassMarkdown } from "../researchFormat";

describe("prepassMarkdown", () => {
  it("strips thinking blocks and normalizes blank lines", () => {
    const input = "Hello\r\n\r\n<thinking>secret</thinking>\r\n\r\n\r\n\r\n\r\nWorld";
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

describe("passesFormattingGuards", () => {
  it("accepts well-formed output with similar length and links", () => {
    const raw = "# Title\n\nClaim [1](https://x.com).\n\n## Sources\n1. [X](https://x.com)";
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
});
