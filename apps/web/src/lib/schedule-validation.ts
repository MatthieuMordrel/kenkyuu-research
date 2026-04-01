import type { GenericId } from "convex/values";

// --- Form Data ---

export type EarningsMode = "each" | "after_last" | "before_first";

export interface EarningsConfigFormData {
  offsetDays: number;
  runTimeUTC: string;
  adjustForHour: boolean;
  earningsMode?: EarningsMode;
}

export interface ScheduleFormData {
  name: string;
  promptId: string;
  stockSelection: {
    type: "all" | "tagged" | "specific" | "none";
    tags?: string[];
    stockIds?: GenericId<"stocks">[];
  };
  triggerType: "cron" | "earnings";
  cron: string;
  earningsConfig: EarningsConfigFormData;
  timezone: string;
}

// --- Form Errors ---

export interface ScheduleFormErrors {
  name?: string;
  promptId?: string;
  stockSelection?: string;
  cron?: string;
  earningsConfig?: string;
  timezone?: string;
}

// --- Cron Validation ---

const CRON_PRESETS = new Set([
  "@daily",
  "@midnight",
  "@weekly",
  "@monthly",
  "@hourly",
]);

function validateCronField(
  field: string,
  min: number,
  max: number,
  fieldName: string,
): string | undefined {
  if (field === "*") return undefined;

  const segments = field.split(",");
  for (const segment of segments) {
    if (segment.includes("/")) {
      const [rangeStr, stepStr] = segment.split("/");
      const step = Number.parseInt(stepStr!, 10);
      if (Number.isNaN(step) || step <= 0) {
        return `Invalid step value in ${fieldName}: "${stepStr}"`;
      }
      if (rangeStr !== "*") {
        const rangeError = validateCronRange(rangeStr!, min, max, fieldName);
        if (rangeError) return rangeError;
      }
    } else if (segment.includes("-")) {
      const rangeError = validateCronRange(segment, min, max, fieldName);
      if (rangeError) return rangeError;
    } else {
      const val = Number.parseInt(segment, 10);
      if (Number.isNaN(val) || val < min || val > max) {
        return `${fieldName} value "${segment}" must be between ${min} and ${max}`;
      }
    }
  }
  return undefined;
}

function validateCronRange(
  range: string,
  min: number,
  max: number,
  fieldName: string,
): string | undefined {
  const [startStr, endStr] = range.split("-");
  const start = Number.parseInt(startStr!, 10);
  const end = Number.parseInt(endStr!, 10);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return `Invalid range in ${fieldName}: "${range}"`;
  }
  if (start < min || start > max || end < min || end > max) {
    return `${fieldName} range "${range}" must be between ${min} and ${max}`;
  }
  if (start > end) {
    return `${fieldName} range start (${start}) must not exceed end (${end})`;
  }
  return undefined;
}

export function validateCron(cron: string): string | undefined {
  const trimmed = cron.trim();
  if (!trimmed) {
    return "Cron expression is required";
  }

  if (CRON_PRESETS.has(trimmed)) {
    return undefined;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return "Cron expression must have 5 fields (minute hour day month weekday) or use a preset (@daily, @weekly, @monthly, @hourly)";
  }

  const fieldDefs: [string, number, number, string][] = [
    [parts[0]!, 0, 59, "Minute"],
    [parts[1]!, 0, 23, "Hour"],
    [parts[2]!, 1, 31, "Day of month"],
    [parts[3]!, 1, 12, "Month"],
    [parts[4]!, 0, 6, "Day of week"],
  ];

  for (const [field, min, max, name] of fieldDefs) {
    const error = validateCronField(field, min, max, name);
    if (error) return error;
  }

  return undefined;
}

// --- Timezone Validation ---

export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Zurich",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC",
] as const;

export function validateTimezone(timezone: string): string | undefined {
  const trimmed = timezone.trim();
  if (!trimmed) {
    return "Timezone is required";
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return undefined;
  } catch {
    return `Invalid timezone: "${trimmed}"`;
  }
}

// --- Individual Validators ---

export function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Schedule name is required";
  }
  if (trimmed.length > 100) {
    return "Schedule name must be 100 characters or less";
  }
  return undefined;
}

/**
 * Auto-generate a descriptive schedule name from the selected prompt and stock configuration.
 * Examples:
 *   "Earnings Analysis — AAPL"
 *   "Portfolio Review — All Stocks"
 *   "Sector Compare — #tech (3 stocks)"
 *   "Market Discovery"
 */
export function generateScheduleName(
  promptName: string,
  stockSelection: ScheduleFormData["stockSelection"],
  stocks?: Array<{ _id: GenericId<"stocks">; ticker: string }>,
): string {
  if (stockSelection.type === "none") {
    return promptName;
  }

  if (stockSelection.type === "all") {
    return `${promptName} — All Stocks`;
  }

  if (stockSelection.type === "tagged") {
    const tags = stockSelection.tags ?? [];
    if (tags.length === 0) return promptName;
    const tagStr = tags.map((t) => `#${t}`).join(", ");
    return `${promptName} — ${tagStr}`;
  }

  if (stockSelection.type === "specific") {
    const ids = stockSelection.stockIds ?? [];
    if (ids.length === 0) return promptName;
    if (stocks) {
      const tickers = ids
        .map((id) => stocks.find((s) => s._id === id)?.ticker)
        .filter(Boolean) as string[];
      if (tickers.length <= 3) {
        return `${promptName} — ${tickers.join(", ")}`;
      }
      return `${promptName} — ${tickers.length} stocks`;
    }
    return `${promptName} — ${ids.length} stock${ids.length === 1 ? "" : "s"}`;
  }

  return promptName;
}

export function validatePromptId(promptId: string): string | undefined {
  if (!promptId) {
    return "Prompt is required";
  }
  return undefined;
}

export function validateStockSelection(stockSelection: ScheduleFormData["stockSelection"]): string | undefined {
  if (stockSelection.type === "tagged") {
    if (!stockSelection.tags || stockSelection.tags.length === 0) {
      return "At least one tag is required when using tag-based selection";
    }
  }
  if (stockSelection.type === "specific") {
    if (!stockSelection.stockIds || stockSelection.stockIds.length === 0) {
      return "At least one stock is required when using specific stock selection";
    }
  }
  return undefined;
}

// --- Earnings Config Validation ---

const RUN_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateEarningsConfig(config: EarningsConfigFormData): string | undefined {
  if (!Number.isInteger(config.offsetDays)) {
    return "Offset days must be a whole number";
  }
  if (config.offsetDays < -7 || config.offsetDays > 14) {
    return "Offset days must be between -7 and 14";
  }
  if (!RUN_TIME_REGEX.test(config.runTimeUTC)) {
    return "Run time must be in HH:MM format (00:00 - 23:59)";
  }
  return undefined;
}

// --- Combined Validator ---

export type PromptType = "single-stock" | "multi-stock" | "discovery";

export function getAllowedStockModes(
  promptType: PromptType | null,
): Array<"all" | "tagged" | "specific" | "none"> {
  switch (promptType) {
    case "discovery":
      return ["none"];
    case "single-stock":
    case "multi-stock":
      return ["all", "tagged", "specific"];
    default:
      return [];
  }
}

export function validateScheduleForm(
  data: ScheduleFormData,
  promptType?: PromptType | null,
): ScheduleFormErrors {
  const errors: ScheduleFormErrors = {};

  // Name is auto-generated, no validation needed

  const promptError = validatePromptId(data.promptId);
  if (promptError) errors.promptId = promptError;

  const stockError = validateStockSelection(data.stockSelection);
  if (stockError) errors.stockSelection = stockError;

  if (data.triggerType === "earnings") {
    const earningsError = validateEarningsConfig(data.earningsConfig);
    if (earningsError) errors.earningsConfig = earningsError;

    // Earnings triggers require stock selection
    if (data.stockSelection.type === "none") {
      errors.stockSelection = "Earnings-based schedules require stock selection";
    }
  } else {
    const cronError = validateCron(data.cron);
    if (cronError) errors.cron = cronError;
  }

  // Prompt-type-aware cross-validation
  if (promptType) {
    if (promptType === "discovery" && data.stockSelection.type !== "none") {
      errors.stockSelection = "Discovery prompts do not use stock selection";
    }
    if ((promptType === "single-stock" || promptType === "multi-stock") && data.stockSelection.type === "none") {
      errors.stockSelection = "This prompt type requires stock selection";
    }
    if (promptType === "discovery" && data.triggerType === "earnings") {
      errors.earningsConfig = "Earnings triggers require stocks; not compatible with discovery prompts";
    }
  }

  const tzError = validateTimezone(data.timezone);
  if (tzError) errors.timezone = tzError;

  return errors;
}

export function hasErrors(errors: ScheduleFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

// --- Next Run Computation (client-side, pure functions) ---

type FieldSpec = { type: "any" } | { type: "values"; values: Set<number> };

interface CronFields {
  minute: FieldSpec;
  hour: FieldSpec;
  dayOfMonth: FieldSpec;
  month: FieldSpec;
  dayOfWeek: FieldSpec;
}

function parseCronField(field: string, min: number, max: number): FieldSpec {
  if (field === "*") return { type: "any" };
  const values = new Set<number>();
  for (const segment of field.split(",")) {
    if (segment.includes("/")) {
      const [rangeStr, stepStr] = segment.split("/");
      const step = Number.parseInt(stepStr!, 10);
      let start = min, end = max;
      if (rangeStr !== "*") {
        if (rangeStr!.includes("-")) {
          const [rStart, rEnd] = rangeStr!.split("-").map((s) => Number.parseInt(s, 10));
          start = rStart!; end = rEnd!;
        } else {
          start = Number.parseInt(rangeStr!, 10);
        }
      }
      for (let i = start; i <= end; i += step) values.add(i);
    } else if (segment.includes("-")) {
      const [start, end] = segment.split("-").map((s) => Number.parseInt(s, 10));
      for (let i = start!; i <= end!; i++) values.add(i);
    } else {
      values.add(Number.parseInt(segment, 10));
    }
  }
  return { type: "values", values };
}

function parseCronExpr(expr: string): CronFields {
  const trimmed = expr.trim();
  if (trimmed === "@daily" || trimmed === "@midnight") return parseCronExpr("0 0 * * *");
  if (trimmed === "@weekly") return parseCronExpr("0 0 * * 0");
  if (trimmed === "@monthly") return parseCronExpr("0 0 1 * *");
  if (trimmed === "@hourly") return parseCronExpr("0 * * * *");
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) throw new Error("Invalid cron");
  return {
    minute: parseCronField(parts[0]!, 0, 59),
    hour: parseCronField(parts[1]!, 0, 23),
    dayOfMonth: parseCronField(parts[2]!, 1, 31),
    month: parseCronField(parts[3]!, 1, 12),
    dayOfWeek: parseCronField(parts[4]!, 0, 6),
  };
}

function matchesCronField(spec: FieldSpec, value: number): boolean {
  return spec.type === "any" || spec.values.has(value);
}

interface TzParts {
  year: number; month: number; dayOfMonth: number;
  dayOfWeek: number; hour: number; minute: number;
}

function getPartsInTz(date: Date, tz: string): TzParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "numeric", day: "numeric",
    weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const wdStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const h = get("hour");
  return { year: get("year"), month: get("month"), dayOfMonth: get("day"), dayOfWeek: wdMap[wdStr] ?? 0, hour: h === 24 ? 0 : h, minute: get("minute") };
}

function tzPartsToUtc(p: TzParts, tz: string): number {
  const iso = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.dayOfMonth).padStart(2, "0")}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:00`;
  const roughUtc = new Date(iso + "Z").getTime();
  const rp = getPartsInTz(new Date(roughUtc), tz);
  const offsetMin = (rp.hour * 60 + rp.minute) - (p.hour * 60 + p.minute);
  return roughUtc - offsetMin * 60_000;
}

/**
 * Compute the next cron run time after `afterMs` in the given timezone.
 * Returns a UTC timestamp, or null if computation fails.
 */
export function computeNextCronRun(cronExpr: string, timezone: string, afterMs?: number): number | null {
  try {
    const parsed = parseCronExpr(cronExpr);
    const after = new Date(afterMs ?? Date.now());
    const candidate = new Date(after);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);

    // Check up to 7 days of minutes (covers monthly edge cases too for common usage)
    const maxIter = 7 * 24 * 60;
    for (let i = 0; i < maxIter; i++) {
      const tp = getPartsInTz(candidate, timezone);
      if (
        matchesCronField(parsed.minute, tp.minute) &&
        matchesCronField(parsed.hour, tp.hour) &&
        matchesCronField(parsed.dayOfMonth, tp.dayOfMonth) &&
        matchesCronField(parsed.month, tp.month) &&
        matchesCronField(parsed.dayOfWeek, tp.dayOfWeek)
      ) {
        return tzPartsToUtc(tp, timezone);
      }
      candidate.setMinutes(candidate.getMinutes() + 1);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Format a UTC timestamp as a human-readable "next run" string.
 */
export function formatNextRun(timestamp: number, timezone: string): string {
  const now = Date.now();
  const diff = timestamp - now;

  if (diff < 0) return "overdue";

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let relative: string;
  if (minutes < 1) {
    relative = "in less than a minute";
  } else if (minutes < 60) {
    relative = `in ${minutes}m`;
  } else if (hours < 24) {
    relative = `in ${hours}h ${minutes % 60}m`;
  } else if (days < 7) {
    relative = `in ${days}d ${hours % 24}h`;
  } else {
    relative = new Date(timestamp).toLocaleDateString();
  }

  // Also show the actual time in the schedule's timezone
  const timeStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));

  return `${relative} (${timeStr})`;
}

// --- Cron Display Helpers ---

export function describeEarningsTrigger(config: EarningsConfigFormData): string {
  const offset = config.offsetDays;
  let timing: string;

  if (offset === 0) {
    timing = "On earnings day";
  } else if (offset === 1) {
    timing = "1 day after earnings";
  } else if (offset === -1) {
    timing = "1 day before earnings";
  } else if (offset > 0) {
    timing = `${offset} days after earnings`;
  } else {
    timing = `${Math.abs(offset)} days before earnings`;
  }

  const time = config.runTimeUTC;
  const amcNote = config.adjustForHour ? " (AMC delayed to next day)" : "";

  const modeLabels: Record<string, string> = {
    each: "",
    after_last: " · After last stock reports",
    before_first: " · Before first stock reports",
  };
  const modeNote = modeLabels[config.earningsMode ?? "each"] ?? "";

  return `${timing} at ${time} UTC${amcNote}${modeNote}`;
}

export function describeCron(cron: string): string {
  const trimmed = cron.trim();

  if (trimmed === "@daily" || trimmed === "@midnight") return "Daily at midnight";
  if (trimmed === "@weekly") return "Weekly on Sunday at midnight";
  if (trimmed === "@monthly") return "Monthly on the 1st at midnight";
  if (trimmed === "@hourly") return "Every hour";

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return trimmed;

  const [minute, hour, dom, month, dow] = parts;

  const pieces: string[] = [];

  if (minute !== "*" && hour !== "*" && dom === "*" && month === "*" && dow === "*") {
    pieces.push(`Daily at ${hour}:${minute!.padStart(2, "0")}`);
  } else if (minute !== "*" && hour !== "*" && dom === "*" && month === "*" && dow !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = days[Number.parseInt(dow!, 10)] ?? dow;
    pieces.push(`Weekly on ${dayName} at ${hour}:${minute!.padStart(2, "0")}`);
  } else if (minute !== "*" && hour !== "*" && dom !== "*" && month === "*" && dow === "*") {
    pieces.push(`Monthly on day ${dom} at ${hour}:${minute!.padStart(2, "0")}`);
  } else {
    pieces.push(trimmed);
  }

  return pieces.join(", ");
}
