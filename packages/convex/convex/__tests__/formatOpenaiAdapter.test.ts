import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORMAT_MODEL_ID,
  resolveFormatModel,
} from "@repo/research-models/format-models";
import { FORMAT_SYSTEM_PROMPT } from "@repo/research-models/format-prompt";
import { buildFormatResponseCreateParams } from "../providers/formatOpenaiAdapter";

describe("buildFormatResponseCreateParams", () => {
  it("uses background Responses API without research tools", () => {
    const model = resolveFormatModel(DEFAULT_FORMAT_MODEL_ID);
    const params = buildFormatResponseCreateParams(model, "# Draft\n\nBody.");

    expect(params.model).toBe("gpt-4.1-mini");
    expect(params.instructions).toBe(FORMAT_SYSTEM_PROMPT);
    expect(params.input).toBe("# Draft\n\nBody.");
    expect(params.background).toBe(true);
    expect(params.tools).toBeUndefined();
    expect(params.reasoning).toBeUndefined();
  });
});
