import { describe, expect, it } from "vitest";
import {
  FORMAT_FRAGMENT_FIRST_USER_INSTRUCTIONS,
  FORMAT_USER_MESSAGE_SEPARATOR,
  buildFormatUserMessageForChunk,
  getFormatSystemPrompt,
  getResearchFormatPromptView,
} from "./format-prompt";
import { DEFAULT_FORMAT_MODEL_ID } from "./format-models";

describe("buildFormatUserMessageForChunk", () => {
  it("joins instructions, separator, and research markdown for single-chunk reports", () => {
    const body = "# Report\n\nContent";
    const message = buildFormatUserMessageForChunk(body, 0, 1);

    expect(message.endsWith(body)).toBe(true);
    expect(message).toContain(FORMAT_USER_MESSAGE_SEPARATOR);
  });

  it("uses fragment instructions for multi-chunk reports", () => {
    const body = "## Section\n\nContent";
    const first = buildFormatUserMessageForChunk(body, 0, 3);
    const middle = buildFormatUserMessageForChunk(body, 1, 3);

    expect(first.startsWith(FORMAT_FRAGMENT_FIRST_USER_INSTRUCTIONS)).toBe(true);
    expect(middle).not.toContain(FORMAT_FRAGMENT_FIRST_USER_INSTRUCTIONS);
  });
});

describe("getFormatSystemPrompt", () => {
  it("appends fragment instructions for multi-chunk reports", () => {
    expect(getFormatSystemPrompt(1)).not.toContain("Fragment mode");
    expect(getFormatSystemPrompt(2)).toContain("Fragment mode");
  });
});

describe("getResearchFormatPromptView", () => {
  it("reflects the default formatter model and prompt constants", () => {
    const view = getResearchFormatPromptView();

    expect(view.modelId).toBe(DEFAULT_FORMAT_MODEL_ID);
    expect(view.systemPrompt.length).toBeGreaterThan(100);
    expect(view.userMessageInstructions.length).toBeGreaterThan(20);
    expect(view.temperature).toBe(0);
  });
});
