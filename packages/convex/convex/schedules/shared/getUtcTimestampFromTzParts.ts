import {
  getDatePartsInTimezone,
  type TzDateParts,
} from "./getDatePartsInTimezone";

/** Convert wall-clock date parts in a timezone back to a UTC timestamp. */
export function getUtcTimestampFromTzParts(
  parts: TzDateParts,
  timezone: string
): number {
  const isoStr = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.dayOfMonth).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:00`;

  const roughUtc = new Date(isoStr + "Z").getTime();
  const roughParts = getDatePartsInTimezone(new Date(roughUtc), timezone);
  const roughOffsetMinutes =
    roughParts.hour * 60 + roughParts.minute - (parts.hour * 60 + parts.minute);

  return roughUtc - roughOffsetMinutes * 60 * 1000;
}
