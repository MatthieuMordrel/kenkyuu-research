import { describe, expect, it } from "vitest";
import { RESEARCH_MODELS } from "./models";
import {
  ANTHROPIC_THINKING_OPTIONS,
  getResearchModelDetailRows,
  MODEL_MAX_OUTPUT_TOKENS_LABEL,
} from "./model-details";

describe("getResearchModelDetailRows", () => {
  it("includes OpenAI effort options with xhigh active for GPT-5.5", () => {
    const rows = getResearchModelDetailRows(RESEARCH_MODELS["openai/gpt-5.5"]);
    const effortRow = rows.find((row) => row.label === "Reasoning effort");
    expect(effortRow).toMatchObject({
      value: "xhigh",
      options: expect.arrayContaining(["none", "low", "medium", "high", "xhigh"]),
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        { label: "Max tool calls", value: "150" },
        { label: "Web search", value: "High context" },
      ])
    );
    expect(rows.find((row) => row.label === "Max output tokens")).toBeUndefined();
  });

  it("includes Anthropic effort and thinking options for Opus", () => {
    const rows = getResearchModelDetailRows(
      RESEARCH_MODELS["anthropic/claude-opus-4-8"]
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          label: "Effort",
          value: "xhigh",
          options: ["low", "medium", "high", "xhigh"],
        },
        {
          label: "Thinking",
          value: "adaptive",
          options: ANTHROPIC_THINKING_OPTIONS,
        },
        { label: "Max web searches", value: "100" },
        {
          label: "Max output tokens",
          value: MODEL_MAX_OUTPUT_TOKENS_LABEL,
        },
      ])
    );
  });
});
