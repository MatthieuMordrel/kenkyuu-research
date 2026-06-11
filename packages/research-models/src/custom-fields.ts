/**
 * User-defined structured output fields attached to a research prompt.
 *
 * A prompt can declare extra values it wants the research agent to determine
 * (e.g. "Estimated CAGR" over 3 years). The definitions are snapshotted onto
 * each job, injected into the research prompt as a machine-readable contract,
 * and parsed back out of the model's markdown into {@link CustomFieldValue}s
 * for display. The agent may return `null` for any field it cannot support
 * from its research rather than guessing.
 */

/** Render/format hint for a custom field. Drives the agent's formatting and UI display. */
export type CustomFieldType = "text" | "number" | "percentage" | "currency";

/** Author-time definition of a custom field, stored on a prompt and snapshotted onto jobs. */
export interface CustomFieldDefinition {
  /** Stable id; maps a filled value back to its definition even if the title changes. */
  id: string;
  /** Label shown in the UI and used to describe the field to the agent. */
  title: string;
  /** What the agent should fill in. This is the instruction the model follows. */
  description: string;
  /** Formatting hint for the agent and the renderer. */
  type: CustomFieldType;
}

/** A custom field after the agent filled it for a specific job. */
export interface CustomFieldValue {
  /** Matches {@link CustomFieldDefinition.id}. */
  id: string;
  /** Snapshot of the definition title at fill time. */
  title: string;
  /** Snapshot of the definition type at fill time. */
  type: CustomFieldType;
  /** Formatted value as a string, or `null` when the agent could not determine it. */
  value: string | null;
}

/** Shared authoring limits, enforced both client-side and in Convex validation. */
export const CUSTOM_FIELD_LIMITS = {
  maxFields: 12,
  maxTitleLength: 80,
  maxDescriptionLength: 500,
} as const;

/** All valid custom field types, for validation and UI pickers. */
export const CUSTOM_FIELD_TYPES: readonly CustomFieldType[] = [
  "text",
  "number",
  "percentage",
  "currency",
];

/** Human label + example for each type, shown in the UI and in the agent contract. */
export const CUSTOM_FIELD_TYPE_META: Record<
  CustomFieldType,
  { label: string; example: string }
> = {
  text: { label: "Text", example: "Strong" },
  number: { label: "Number", example: "12.5" },
  percentage: { label: "Percentage", example: "15%" },
  currency: { label: "Currency", example: "$1.2B" },
};

/**
 * HTML-comment marker the agent wraps its JSON answer in. A comment keeps the
 * block invisible if it ever slips past stripping into a markdown renderer.
 */
const BLOCK_LABEL = "KENKYUU_FIELDS";

/** Matches the agent's machine-readable block and captures the JSON payload. */
const BLOCK_REGEX = new RegExp(`<!--\\s*${BLOCK_LABEL}\\b([\\s\\S]*?)-->`, "i");

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Where the agent must place the machine-readable fields block.
 *
 * Chat harnesses (Anthropic Messages, OpenAI Responses) return the report as
 * the model's reply, so the block goes at the end of that reply. The Managed
 * Agents harness instead delivers a report *file* that is consumed verbatim —
 * its coordinator is told to keep chat messages to brief status notes — so the
 * block must live at the end of that file, or extraction never sees it.
 */
export type CustomFieldsDelivery =
  | { location: "message" }
  | { location: "file"; filePath: string };

/**
 * Builds the prompt section appended to a research template when the prompt
 * declares custom fields. Returns an empty string when there are none.
 *
 * `delivery` decides where the agent is told to emit the block so it lands in
 * the same text {@link extractCustomFieldValues} later parses (the reply for
 * chat harnesses, the report file for the Managed Agents harness).
 */
export function buildCustomFieldsPromptSection(
  fields: CustomFieldDefinition[],
  delivery: CustomFieldsDelivery = { location: "message" }
): string {
  if (fields.length === 0) return "";

  const fieldLines = fields
    .map((field, index) => {
      const meta = CUSTOM_FIELD_TYPE_META[field.type];
      return `${index + 1}. ${field.title} (id: \`${field.id}\`, type: ${field.type}, e.g. ${meta.example})\n   ${field.description}`;
    })
    .join("\n");

  const jsonTemplate = `{${fields.map((f) => `"${f.id}": <value>`).join(", ")}}`;

  const appendInstruction =
    delivery.location === "file"
      ? `After the complete report, append the following machine-readable block to the very end of the report file at \`${delivery.filePath}\` (after all report content), exactly once and nowhere else. It must live inside that file — not in a chat message:`
      : `After the complete report, append the following machine-readable block as the very last content of your response, exactly once and nowhere else:`;

  return `

---

## Required Structured Output Fields

Beyond the report, determine a value for each field below, based strictly on your research. If your research does not support a value, return \`null\` for that field — do not guess or fabricate.

${fieldLines}

${appendInstruction}

<!--${BLOCK_LABEL}
${jsonTemplate}
-->

Each \`<value>\` is a JSON string with the value formatted for its type (text → a short phrase; number → a plain number like "12.5"; percentage → like "15%"; currency → like "$1.2B"), or \`null\` if unavailable. The block must be valid JSON.`;
}

/** Normalizes a raw JSON value into a display string, or null when unavailable. */
function normalizeValue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const str = typeof raw === "string" ? raw.trim() : String(raw);
  if (str === "") return null;
  const lowered = str.toLowerCase();
  if (lowered === "null" || lowered === "n/a" || lowered === "na") return null;
  return str;
}

/** Parses the captured block payload into a plain object, tolerating trailing commas. */
function safeParseFieldObject(payload: string): Record<string, unknown> | null {
  const candidates = [payload, payload.replace(/,\s*([}\]])/g, "$1")];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Removes the agent's block (and any code fence it was wrapped in) from the markdown. */
function stripBlock(text: string, block: string): string {
  const wrapped = new RegExp(
    `(?:\`\`\`[A-Za-z]*\\s*)?${escapeRegExp(block)}(?:\\s*\`\`\`)?`,
    "i"
  );
  return text
    .replace(wrapped, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extracts custom field values from research markdown and strips the agent's
 * machine-readable block out of the displayed report.
 *
 * Every declared field is always returned (in declaration order): fields the
 * agent omitted or could not determine come back with `value: null`.
 */
export function extractCustomFieldValues(
  rawText: string,
  fields: CustomFieldDefinition[]
): { markdown: string; values: CustomFieldValue[] } {
  const baseValues: CustomFieldValue[] = fields.map((field) => ({
    id: field.id,
    title: field.title,
    type: field.type,
    value: null,
  }));

  if (fields.length === 0) {
    return { markdown: rawText, values: baseValues };
  }

  const match = rawText.match(BLOCK_REGEX);
  if (!match) {
    return { markdown: rawText, values: baseValues };
  }

  const parsed = safeParseFieldObject(match[1] ?? "");
  const values = parsed
    ? fields.map((field) => ({
        id: field.id,
        title: field.title,
        type: field.type,
        value: normalizeValue(parsed[field.id]),
      }))
    : baseValues;

  return { markdown: stripBlock(rawText, match[0]), values };
}
