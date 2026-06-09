import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { api } from "@repo/convex";
import type { FunctionReturnType } from "convex/server";
import { useAuthToken } from "@/lib/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export type SymbolSuggestion = FunctionReturnType<
  typeof api.stockLookupActions.searchStockSymbols
>["results"][number];

export type ResolvedStockSymbol = FunctionReturnType<
  typeof api.stockLookupActions.resolveStockSymbol
>;

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

interface UseStockSymbolLookupOptions {
  /** When false, no Finnhub requests are made. */
  enabled: boolean;
  query: string;
}

/**
 * Debounced Finnhub symbol search and one-shot resolve on user selection.
 */
export function useStockSymbolLookup({
  enabled,
  query,
}: UseStockSymbolLookupOptions) {
  const token = useAuthToken();
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const searchAction = useAction(api.stockLookupActions.searchStockSymbols);
  const resolveAction = useAction(api.stockLookupActions.resolveStockSymbol);

  const searchQuery = useQuery({
    queryKey: ["stock-symbol-search", debouncedQuery],
    queryFn: () => {
      if (!token) {
        throw new Error("Unauthorized");
      }
      return searchAction({ token, query: debouncedQuery });
    },
    enabled: enabled && !!token && debouncedQuery.length >= MIN_QUERY_LENGTH,
    staleTime: 60_000,
  });

  async function resolve(finnhubSymbol: string): Promise<ResolvedStockSymbol> {
    if (!token) {
      throw new Error("Unauthorized");
    }
    return resolveAction({ token, finnhubSymbol });
  }

  return {
    suggestions: searchQuery.data?.results ?? [],
    configured: searchQuery.data?.configured ?? true,
    isLoading: searchQuery.isFetching,
    error: searchQuery.error,
    resolve,
  };
}
