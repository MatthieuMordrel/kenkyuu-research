/**
 * Maps stock exchange identifiers to their market timezones.
 *
 * Used by earnings triggers to evaluate each stock's earnings date
 * in its own market's local time, rather than a single schedule-level timezone.
 *
 * The mapping covers major global exchanges. Unknown exchanges default to
 * America/New_York since most stocks in the system are US-listed.
 */

const EXCHANGE_TIMEZONE_MAP: Record<string, string> = {
  // United States
  NYSE: "America/New_York",
  NASDAQ: "America/New_York",
  AMEX: "America/New_York",
  ARCA: "America/New_York",
  BATS: "America/New_York",
  OTC: "America/New_York",
  CBOE: "America/New_York",

  // Canada
  TSX: "America/Toronto",
  TSXV: "America/Toronto",
  CSE: "America/Toronto",
  NEO: "America/Toronto",

  // United Kingdom
  LSE: "Europe/London",
  "LSE-INTL": "Europe/London",
  AIM: "Europe/London",

  // Continental Europe
  XETRA: "Europe/Berlin",
  FRA: "Europe/Berlin",
  EURONEXT: "Europe/Paris",
  EPA: "Europe/Paris",
  AMS: "Europe/Amsterdam",
  EBR: "Europe/Brussels",
  LIS: "Europe/Lisbon",
  BIT: "Europe/Rome",
  BME: "Europe/Madrid",
  SIX: "Europe/Zurich",
  SWX: "Europe/Zurich",
  OMX: "Europe/Stockholm",
  CPH: "Europe/Copenhagen",
  HEL: "Europe/Helsinki",
  OSE: "Europe/Oslo",
  WSE: "Europe/Warsaw",
  VSE: "Europe/Vienna",

  // Asia-Pacific
  TSE: "Asia/Tokyo",
  TYO: "Asia/Tokyo",
  JPX: "Asia/Tokyo",
  HKEX: "Asia/Hong_Kong",
  HKG: "Asia/Hong_Kong",
  SSE: "Asia/Shanghai",
  SZSE: "Asia/Shanghai",
  SGX: "Asia/Singapore",
  KRX: "Asia/Seoul",
  KOSDAQ: "Asia/Seoul",
  TWSE: "Asia/Taipei",
  BSE: "Asia/Kolkata",
  NSE: "Asia/Kolkata",
  ASX: "Australia/Sydney",
  NZX: "Pacific/Auckland",

  // Middle East
  TASE: "Asia/Jerusalem",
  DFM: "Asia/Dubai",
  ADX: "Asia/Dubai",
  TADAWUL: "Asia/Riyadh",

  // Latin America
  BOVESPA: "America/Sao_Paulo",
  B3: "America/Sao_Paulo",
  BMV: "America/Mexico_City",

  // Africa
  JSE: "Africa/Johannesburg",
};

const DEFAULT_TIMEZONE = "America/New_York";

/**
 * Returns the market timezone for a given exchange.
 *
 * Performs a case-insensitive lookup against known exchanges.
 * Falls back to America/New_York for unknown exchanges.
 */
export function getMarketTimezone(exchange: string): string {
  // Try exact match first (most common path)
  const direct = EXCHANGE_TIMEZONE_MAP[exchange];
  if (direct) return direct;

  // Case-insensitive fallback
  const upper = exchange.toUpperCase().trim();
  const match = EXCHANGE_TIMEZONE_MAP[upper];
  if (match) return match;

  // Check if exchange string contains a known key (e.g. "NASDAQ GS" → NASDAQ)
  for (const [key, tz] of Object.entries(EXCHANGE_TIMEZONE_MAP)) {
    if (upper.includes(key)) return tz;
  }

  return DEFAULT_TIMEZONE;
}
