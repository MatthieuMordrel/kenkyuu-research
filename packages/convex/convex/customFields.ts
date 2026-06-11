/**
 * Convex validators for user-defined custom output fields.
 *
 * Definitions live on a prompt and are snapshotted onto each research job;
 * filled values are stored on the job after the research pass. The pure
 * helpers (prompt building, parsing) live in `@repo/research-models/custom-fields`.
 */
import { v } from "convex/values";

/** Formatting hint for a custom field. Mirrors `CustomFieldType`. */
export const customFieldTypeValidator = v.union(
  v.literal("text"),
  v.literal("number"),
  v.literal("percentage"),
  v.literal("currency")
);

/** Author-time definition stored on prompts and snapshotted onto jobs. */
export const customFieldDefinitionValidator = v.object({
  id: v.string(),
  title: v.string(),
  description: v.string(),
  type: customFieldTypeValidator,
});

/** A custom field after the research agent filled it (or left it unavailable). */
export const customFieldValueValidator = v.object({
  id: v.string(),
  title: v.string(),
  type: customFieldTypeValidator,
  value: v.union(v.string(), v.null()),
});
