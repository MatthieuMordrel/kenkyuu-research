/** Get the fiscal quarter key from earnings records, e.g. "Q1-2026" */
export function getQuarterKey(quarter: number, year: number): string {
  return `Q${quarter}-${year}`;
}
