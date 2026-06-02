import { describe, expect, it } from "vitest";
import {
  BUILT_IN_DISCOVERY_PROMPT,
  RESEARCH_SYSTEM_PROMPT,
  getResearchPromptView,
} from "./research-prompt";

describe("getResearchPromptView", () => {
  it("exposes the shared system prompt for all providers", () => {
    const view = getResearchPromptView();

    expect(view.systemPrompt).toBe(RESEARCH_SYSTEM_PROMPT);
    expect(view.systemPrompt).toContain("GitHub-flavored Markdown");
    expect(view.systemPrompt).toContain("Research rules:");
    expect(view.systemPrompt).not.toContain("Formatting rules:");
    expect(view.providers).toHaveLength(2);
    expect(view.builtInDiscoveryTemplate).toBe(BUILT_IN_DISCOVERY_PROMPT.template);
  });
});
