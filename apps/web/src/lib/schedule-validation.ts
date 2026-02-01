import type { GenericId } from "convex/values";

// --- Form Data ---

export interface ScheduleFormData {
  name: string;
  promptId: string;
  stockSelection: {
    type: "all" | "tagged" | "specific" | "none";
    tags?: string[];
    stockIds?: GenericId<"stocks">[];
  };
  cron: string;
  timezone: string;
  enabled: boolean;
}

// --- Form Errors ---

export interface ScheduleFormErrors {
  name?: string;
  promptId?: string;
  stockSelection?: string;
  cron?: string;
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

// --- Combined Validator ---

export function validateScheduleForm(data: ScheduleFormData): ScheduleFormErrors {
  const errors: ScheduleFormErrors = {};

  const nameError = validateName(data.name);
  if (nameError) errors.name = nameError;

  const promptError = validatePromptId(data.promptId);
  if (promptError) errors.promptId = promptError;

  const stockError = validateStockSelection(data.stockSelection);
  if (stockError) errors.stockSelection = stockError;

  const cronError = validateCron(data.cron);
  if (cronError) errors.cron = cronError;

  const tzError = validateTimezone(data.timezone);
  if (tzError) errors.timezone = tzError;

  return errors;
}

export function hasErrors(errors: ScheduleFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

// --- Cron Display Helpers ---

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
