import { describe, expect, it } from "vitest";
import {
  buildCustomFieldsPromptSection,
  extractCustomFieldValues,
  type CustomFieldDefinition,
} from "./custom-fields";

const FIELDS: CustomFieldDefinition[] = [
  {
    id: "cagr",
    title: "Estimated CAGR",
    description: "Compound annual growth rate over the next 3 years.",
    type: "percentage",
  },
  {
    id: "fairvalue",
    title: "Fair Value",
    description: "Estimated intrinsic value per share.",
    type: "currency",
  },
];

describe("buildCustomFieldsPromptSection", () => {
  it("returns empty string when there are no fields", () => {
    expect(buildCustomFieldsPromptSection([])).toBe("");
  });

  it("lists every field id and emits a JSON template", () => {
    const section = buildCustomFieldsPromptSection(FIELDS);
    expect(section).toContain("Estimated CAGR");
    expect(section).toContain("`cagr`");
    expect(section).toContain("`fairvalue`");
    expect(section).toContain('"cagr": <value>');
    expect(section).toContain("KENKYUU_FIELDS");
  });
});

describe("extractCustomFieldValues", () => {
  it("returns all-null values when no block is present", () => {
    const { markdown, values } = extractCustomFieldValues(
      "# Report\n\nSome research.",
      FIELDS
    );
    expect(markdown).toBe("# Report\n\nSome research.");
    expect(values).toEqual([
      { id: "cagr", title: "Estimated CAGR", type: "percentage", value: null },
      { id: "fairvalue", title: "Fair Value", type: "currency", value: null },
    ]);
  });

  it("parses values and strips the block from the markdown", () => {
    const raw = `# Report\n\nBody text.\n\n<!--KENKYUU_FIELDS\n{"cagr": "15%", "fairvalue": "$1.2B"}\n-->`;
    const { markdown, values } = extractCustomFieldValues(raw, FIELDS);
    expect(markdown).toBe("# Report\n\nBody text.");
    expect(values[0].value).toBe("15%");
    expect(values[1].value).toBe("$1.2B");
  });

  it("treats null / N/A / missing keys as unavailable", () => {
    const raw = `Report\n\n<!--KENKYUU_FIELDS\n{"cagr": null, "fairvalue": "N/A"}\n-->`;
    const { values } = extractCustomFieldValues(raw, FIELDS);
    expect(values[0].value).toBeNull();
    expect(values[1].value).toBeNull();
  });

  it("tolerates a code fence wrapping the block and trailing commas", () => {
    const raw =
      'Report\n\n```\n<!--KENKYUU_FIELDS\n{"cagr": "9%", "fairvalue": "$80",}\n-->\n```';
    const { markdown, values } = extractCustomFieldValues(raw, FIELDS);
    expect(markdown).toBe("Report");
    expect(values[0].value).toBe("9%");
    expect(values[1].value).toBe("$80");
  });

  it("coerces non-string JSON values to strings", () => {
    const raw = `R\n\n<!--KENKYUU_FIELDS\n{"cagr": 15, "fairvalue": "$5"}\n-->`;
    const { values } = extractCustomFieldValues(raw, FIELDS);
    expect(values[0].value).toBe("15");
  });

  it("falls back to all-null when the block JSON is unparseable", () => {
    const raw = `R\n\n<!--KENKYUU_FIELDS\nnot json at all\n-->`;
    const { markdown, values } = extractCustomFieldValues(raw, FIELDS);
    expect(markdown).toBe("R");
    expect(values.every((v) => v.value === null)).toBe(true);
  });
});
