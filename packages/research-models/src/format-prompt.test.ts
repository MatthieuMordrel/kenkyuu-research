import { describe, expect, it } from "vitest";
import { getResearchFormatPromptView } from "./format-prompt";
import { DEFAULT_FORMAT_MODEL_ID } from "./format-models";

describe("getResearchFormatPromptView", () => {
  it("reflects the default formatter model and system prompt", () => {
    const view = getResearchFormatPromptView();

    expect(view.modelId).toBe(DEFAULT_FORMAT_MODEL_ID);
    expect(view.systemPrompt).toContain("GitHub-flavored markdown");
    expect(view.systemPrompt).toContain("user message");
    expect(view.userMessageDescription).toContain("markdown only");
    expect(view.temperature).toBe(0);
  });
});
