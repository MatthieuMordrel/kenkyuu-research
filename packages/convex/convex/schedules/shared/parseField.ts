export type FieldSpec =
  | { type: "any" }
  | { type: "values"; values: Set<number> };

/** @internal Exported for testing */
export function parseField(field: string, min: number, max: number): FieldSpec {
  if (field === "*") {
    return { type: "any" };
  }

  const values = new Set<number>();

  const segments = field.split(",");
  for (const segment of segments) {
    if (segment.includes("/")) {
      const [rangeStr, stepStr] = segment.split("/");
      const step = Number.parseInt(stepStr!, 10);
      if (Number.isNaN(step) || step <= 0) {
        throw new Error(`Invalid step value in cron field: ${field}`);
      }

      let start = min;
      let end = max;

      if (rangeStr !== "*") {
        if (rangeStr!.includes("-")) {
          const [rStart, rEnd] = rangeStr!
            .split("-")
            .map((s) => Number.parseInt(s, 10));
          start = rStart!;
          end = rEnd!;
        } else {
          start = Number.parseInt(rangeStr!, 10);
        }
      }

      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (segment.includes("-")) {
      const [start, end] = segment
        .split("-")
        .map((s) => Number.parseInt(s, 10));
      for (let i = start!; i <= end!; i++) {
        values.add(i);
      }
    } else {
      values.add(Number.parseInt(segment, 10));
    }
  }

  return { type: "values", values };
}
