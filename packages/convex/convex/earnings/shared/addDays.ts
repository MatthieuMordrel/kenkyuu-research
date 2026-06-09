/** Add (or subtract) days to a YYYY-MM-DD date string, returning YYYY-MM-DD. */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid DST issues
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
