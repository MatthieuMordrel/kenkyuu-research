/** Exchange values for the stock form (aligned with Convex `mapFinnhubExchange`). */
export const STOCK_EXCHANGES = [
  "NASDAQ",
  "NYSE",
  "LSE",
  "Euronext",
  "TSX",
  "ASX",
  "TSE",
  "HKEX",
  "SSE",
  "SZSE",
  "KRX",
  "TWSE",
  "SGX",
] as const;

export type StockExchange = (typeof STOCK_EXCHANGES)[number];
