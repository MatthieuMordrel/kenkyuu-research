/** Format a Date as a YYYY-MM-DD string (UTC). */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}
