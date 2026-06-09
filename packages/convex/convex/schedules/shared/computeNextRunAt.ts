import { getDatePartsInTimezone } from "./getDatePartsInTimezone";
import { getUtcTimestampFromTzParts } from "./getUtcTimestampFromTzParts";
import { matchesField } from "./matchesField";
import { parseCron } from "./parseCron";

/**
 * Parse a cron expression and compute the next run time after `afterMs` in the given timezone.
 *
 * Supports standard 5-field cron: minute hour dayOfMonth month dayOfWeek
 * Also supports preset aliases: @daily, @weekly, @monthly, @hourly
 */
/** @internal Exported for testing */
export function computeNextRunAt(
  cronExpr: string,
  timezone: string,
  afterMs: number
): number {
  const parsed = parseCron(cronExpr);
  const after = new Date(afterMs);

  // Start from the next minute after `after`
  const candidate = new Date(after);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Try each minute for up to 366 days to find the next match
  const maxIterations = 366 * 24 * 60;
  for (let i = 0; i < maxIterations; i++) {
    const tzParts = getDatePartsInTimezone(candidate, timezone);

    if (
      matchesField(parsed.minute, tzParts.minute) &&
      matchesField(parsed.hour, tzParts.hour) &&
      matchesField(parsed.dayOfMonth, tzParts.dayOfMonth) &&
      matchesField(parsed.month, tzParts.month) &&
      matchesField(parsed.dayOfWeek, tzParts.dayOfWeek)
    ) {
      return getUtcTimestampFromTzParts(tzParts, timezone);
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  // Fallback: 24 hours from now
  return afterMs + 24 * 60 * 60 * 1000;
}
