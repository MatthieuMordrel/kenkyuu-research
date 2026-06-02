import { describe, expect, it } from "vitest";
import { estimateModelCost } from "./pricing";
import { RESEARCH_MODELS } from "./models";
import {
  assertModelActive,
  getActiveResearchModels,
  resolveActiveModelId,
  resolveStoredModelId,
} from "./resolve";

describe("resolveActiveModelId", () => {
  it("returns active models unchanged", () => {
    expect(resolveActiveModelId("anthropic/claude-opus-4-8")).toBe(
      "anthropic/claude-opus-4-8"
    );
  });

  it("upgrades inactive models to the default active model", () => {
    expect(resolveActiveModelId("openai/o3-deep-research")).toBe(
      "anthropic/claude-opus-4-8"
    );
  });

  it("keeps active OpenAI models unchanged", () => {
    expect(resolveActiveModelId("openai/gpt-5.5")).toBe("openai/gpt-5.5");
  });
});

describe("resolveStoredModelId", () => {
  it("prefers modelId over legacy provider", () => {
    expect(
      resolveStoredModelId({
        modelId: "anthropic/claude-opus-4-8",
        provider: "openai",
      })
    ).toBe("anthropic/claude-opus-4-8");
  });

  it("maps legacy provider when modelId is missing", () => {
    expect(resolveStoredModelId({ provider: "openai" })).toBe(
      "openai/gpt-5.5"
    );
  });
});

describe("assertModelActive", () => {
  it("allows active models", () => {
    expect(() => assertModelActive("anthropic/claude-opus-4-8")).not.toThrow();
  });

  it("rejects inactive models", () => {
    expect(() => assertModelActive("openai/o3-deep-research")).toThrow(
      /disabled/
    );
  });
});

describe("getActiveResearchModels", () => {
  it("returns only active registry entries", () => {
    const active = getActiveResearchModels();
    expect(active.every((model) => model.active)).toBe(true);
    expect(active.some((model) => model.id === "anthropic/claude-opus-4-8")).toBe(
      true
    );
    expect(active.some((model) => model.id === "openai/gpt-5.5")).toBe(true);
    expect(active.some((model) => model.id === "openai/o3-deep-research")).toBe(
      false
    );
  });
});

describe("estimateModelCost", () => {
  it("uses registry pricing for anthropic opus", () => {
    const model = RESEARCH_MODELS["anthropic/claude-opus-4-8"];
    expect(
      estimateModelCost(model, {
        inputTokens: 1_000_000,
        outputTokens: 0,
        webSearchRequests: 0,
      })
    ).toBe(2.5);
  });
});
