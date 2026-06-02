import { describe, expect, it } from "vitest";
import {
  BUILT_IN_DISCOVERY_PROMPT,
  OPENAI_RESEARCH_INSTRUCTIONS,
  getResearchPromptView,
} from "./research-prompt";

describe("getResearchPromptView", () => {
  it("exposes OpenAI instructions and Anthropic delivery note", () => {
    const view = getResearchPromptView();

    const openai = view.providers.find((p) => p.providerId === "openai");
    const anthropic = view.providers.find((p) => p.providerId === "anthropic");

    expect(openai?.systemInstructions).toBe(OPENAI_RESEARCH_INSTRUCTIONS);
    expect(anthropic?.systemInstructions).toBeNull();
    expect(view.builtInDiscoveryTemplate).toBe(BUILT_IN_DISCOVERY_PROMPT.template);
  });
});
