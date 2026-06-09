import type { FinnhubSearchResult } from "./types";

/**
 * Sort score: lower is better. Exact ticker matches rank first.
 */
export function sortRank(result: FinnhubSearchResult, query: string): number {
  const q = query.trim().toUpperCase();
  const display = result.displaySymbol.toUpperCase();
  if (display === q) {
    return 0;
  }
  if (display.startsWith(q)) {
    return 1;
  }
  if (result.description.toUpperCase().includes(q)) {
    return 2;
  }
  return 3;
}
