import { validateSearchTerm } from "../../validation";
import { MIN_QUERY_LENGTH } from "./minQueryLength";
import { MAX_QUERY_LENGTH } from "./maxQueryLength";

/** Trim and validate a stock symbol lookup query. */
export function normalizeLookupQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    throw new Error(`Query must be at least ${MIN_QUERY_LENGTH} characters`);
  }
  if (trimmed.length > MAX_QUERY_LENGTH) {
    throw new Error(`Query must be at most ${MAX_QUERY_LENGTH} characters`);
  }
  validateSearchTerm(trimmed);
  return trimmed;
}
