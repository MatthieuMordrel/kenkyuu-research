import type { FieldSpec } from "./parseField";

/** @internal Exported for testing */
export function matchesField(spec: FieldSpec, value: number): boolean {
  if (spec.type === "any") return true;
  return spec.values.has(value);
}
