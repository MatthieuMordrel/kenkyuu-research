import type { FinnhubSearchResult, SymbolSuggestion } from "./types";
import { isEligibleType } from "./isEligibleType";
import { sortRank } from "./sortRank";

const MAX_SUGGESTIONS = 8;

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

  const sorted = eligible.toSorted((a, b) => {
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
