import type { FinnhubSearchResult, SymbolSuggestion } from "./types";

const MAX_SUGGESTIONS = 8;

const EXCLUDED_TYPE_KEYWORDS = ["WARRANT", "RIGHT", "UNIT"];

/**
 * Whether a Finnhub security type should appear in add-stock suggestions.
 */
function isEligibleType(type: string): boolean {
  const upper = type.toUpperCase();
  return !EXCLUDED_TYPE_KEYWORDS.some((keyword) => upper.includes(keyword));
}

/**
 * Sort score: lower is better. Exact ticker matches rank first.
 */
function sortRank(result: FinnhubSearchResult, query: string): number {
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

/**
 * Filters and ranks Finnhub search hits for the add-stock combobox.
 *
 * @param results - Raw Finnhub search `result` array.
 * @param query - User search text.
 */
export function rankSearchResults(
  results: FinnhubSearchResult[],
  query: string
): SymbolSuggestion[] {
  const eligible = results.filter((row) => isEligibleType(row.type));

  const sorted = [...eligible].sort((a, b) => {
    const rankDiff = sortRank(a, query) - sortRank(b, query);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    const aCommon = a.type.toUpperCase().includes("COMMON STOCK") ? 0 : 1;
    const bCommon = b.type.toUpperCase().includes("COMMON STOCK") ? 0 : 1;
    if (aCommon !== bCommon) {
      return aCommon - bCommon;
    }
    return a.displaySymbol.localeCompare(b.displaySymbol);
  });

  return sorted.slice(0, MAX_SUGGESTIONS).map((row) => ({
    displaySymbol: row.displaySymbol,
    finnhubSymbol: row.symbol,
    companyName: row.description,
    securityType: row.type,
  }));
}
