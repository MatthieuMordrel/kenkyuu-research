/**
 * Maps Finnhub `exchange` strings from company profile to app exchange labels.
 */

/** Exchange values stored on stocks and shown in the add-stock form. */
export const CANONICAL_EXCHANGES = [
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

export type CanonicalExchange = (typeof CANONICAL_EXCHANGES)[number];

/** Substring rules applied to uppercased Finnhub exchange text. */
const EXCHANGE_RULES: ReadonlyArray<{
  match: (upper: string) => boolean;
  exchange: CanonicalExchange;
}> = [
  { match: (u) => u.includes("NASDAQ"), exchange: "NASDAQ" },
  {
    match: (u) => u.includes("NYSE") || u.includes("NEW YORK"),
    exchange: "NYSE",
  },
  { match: (u) => u.includes("LONDON") || u.includes("LSE"), exchange: "LSE" },
  { match: (u) => u.includes("TOKYO") || u.includes("TSE"), exchange: "TSE" },
  {
    match: (u) => u.includes("HONG KONG") || u.includes("HKEX"),
    exchange: "HKEX",
  },
  { match: (u) => u.includes("EURONEXT"), exchange: "Euronext" },
  {
    match: (u) => u.includes("SHANGHAI") || u.includes("SSE"),
    exchange: "SSE",
  },
  {
    match: (u) => u.includes("SHENZHEN") || u.includes("SZSE"),
    exchange: "SZSE",
  },
  { match: (u) => u.includes("TORONTO") || u.includes("TSX"), exchange: "TSX" },
  {
    match: (u) => u.includes("AUSTRALIAN") || u.includes("ASX"),
    exchange: "ASX",
  },
];

/**
 * Converts a Finnhub profile exchange string to a canonical exchange label.
 *
 * @param raw - Value from Finnhub `company profile2` `exchange` field.
 * @returns Canonical exchange or `null` when no rule matches.
 */
export function mapFinnhubExchange(raw: string | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const upper = raw.toUpperCase();
  for (const rule of EXCHANGE_RULES) {
    if (rule.match(upper)) {
      return rule.exchange;
    }
  }
  return null;
}
