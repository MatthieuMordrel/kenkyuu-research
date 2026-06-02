/** Exchange values for the stock form (aligned with Convex `mapFinnhubExchange`). */
export const STOCK_EXCHANGES = [
  "NASDAQ",
  "NYSE",
  "LSE",
  "TSE",
  "HKEX",
  "Euronext",
  "SSE",
  "SZSE",
  "TSX",
  "ASX",
] as const;

export type StockExchange = (typeof STOCK_EXCHANGES)[number];
