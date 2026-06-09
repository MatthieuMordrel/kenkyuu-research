import { parseField, type FieldSpec } from "./parseField";

export interface CronFields {
  minute: FieldSpec;
  hour: FieldSpec;
  dayOfMonth: FieldSpec;
  month: FieldSpec;
  dayOfWeek: FieldSpec;
}

/** @internal Exported for testing */
export function parseCron(expr: string): CronFields {
  const trimmed = expr.trim();

  if (trimmed === "@daily" || trimmed === "@midnight") {
    return parseCron("0 0 * * *");
  }
  if (trimmed === "@weekly") {
    return parseCron("0 0 * * 0");
  }
  if (trimmed === "@monthly") {
    return parseCron("0 0 1 * *");
  }
  if (trimmed === "@hourly") {
    return parseCron("0 * * * *");
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: expected 5 fields, got ${parts.length}`
    );
  }

  return {
    minute: parseField(parts[0]!, 0, 59),
    hour: parseField(parts[1]!, 0, 23),
    dayOfMonth: parseField(parts[2]!, 1, 31),
    month: parseField(parts[3]!, 1, 12),
    dayOfWeek: parseField(parts[4]!, 0, 6),
  };
}
