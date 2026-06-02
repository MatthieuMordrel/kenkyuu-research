/**
 * Finnhub API shapes used by symbol lookup (search + profile2).
 */

/** A row from `GET /search`. */
export interface FinnhubSearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

/** Response body from `GET /search`. */
export interface FinnhubSearchResponse {
  count: number;
  result: FinnhubSearchResult[];
}

/** Response body from `GET /stock/profile2`. */
export interface FinnhubCompanyProfile {
  name?: string;
  ticker?: string;
  exchange?: string;
  finnhubIndustry?: string;
}

/** Normalized suggestion returned to the client. */
export interface SymbolSuggestion {
  displaySymbol: string;
  finnhubSymbol: string;
  companyName: string;
  securityType: string;
}

/** Resolved listing details after the user picks a suggestion. */
export interface ResolvedStockSymbol {
  ticker: string;
  companyName: string;
  exchange: string;
  sector?: string;
  exchangeUnmapped: boolean;
}
