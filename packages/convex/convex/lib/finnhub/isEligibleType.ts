const EXCLUDED_TYPE_KEYWORDS = ["WARRANT", "RIGHT", "UNIT"];

/**
 * Whether a Finnhub security type should appear in add-stock suggestions.
 */
export function isEligibleType(type: string): boolean {
  const upper = type.toUpperCase();
  return !EXCLUDED_TYPE_KEYWORDS.some((keyword) => upper.includes(keyword));
}
