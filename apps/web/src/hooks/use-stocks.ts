import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useAuthToken } from "@/lib/auth";
import { useCallback } from "react";

// --- Query Hooks ---

interface UseStocksOptions {
  search?: string;
  tag?: string;
  sortBy?: "ticker" | "companyName" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export function useStocks(options: UseStocksOptions = {}) {
  const token = useAuthToken();
  const { search, tag, sortBy, sortOrder } = options;
  const { data } = useQuery(
    convexQuery(
      api.stocks.queries.listStocks.listStocks,
      token
        ? {
            search: search || undefined,
            tag: tag || undefined,
            sortBy,
            sortOrder,
            token,
          }
        : "skip"
    )
  );
  return data;
}

export function useStock(id: GenericId<"stocks">) {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(
      api.stocks.queries.getStock.getStock,
      token ? { id, token } : "skip"
    )
  );
  return data;
}

export function useStockByTicker(ticker: string) {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(
      api.stocks.queries.getStockByTicker.getStockByTicker,
      token ? { ticker, token } : "skip"
    )
  );
  return data;
}

export function useTags() {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(
      api.stocks.queries.listTags.listTags,
      token ? { token } : "skip"
    )
  );
  return data;
}

// --- Mutation Hooks ---

export function useAddStock() {
  const token = useAuthToken();
  const mutation = useConvexMutation(api.stocks.mutations.addStock.addStock);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useUpdateStock() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.stocks.mutations.updateStock.updateStock
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useDeleteStock() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.stocks.mutations.deleteStock.deleteStock
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}
