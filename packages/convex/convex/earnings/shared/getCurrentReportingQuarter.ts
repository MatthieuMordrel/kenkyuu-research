/** Get the current reporting quarter: earnings reported now are typically for the prior quarter */
export function getCurrentReportingQuarter(today: string): {
  quarter: number;
  year: number;
} {
  const d = new Date(today + "T12:00:00Z");
  const month = d.getUTCMonth() + 1; // 1-12
  const year = d.getUTCFullYear();
  // Reporting seasons: Jan-Mar report Q4 of prior year, Apr-Jun report Q1, Jul-Sep report Q2, Oct-Dec report Q3
  if (month <= 3) return { quarter: 4, year: year - 1 };
  if (month <= 6) return { quarter: 1, year };
  if (month <= 9) return { quarter: 2, year };
  return { quarter: 3, year };
}
