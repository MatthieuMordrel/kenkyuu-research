import { useQuery, useMutation } from "convex/react";
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
  return useQuery(
    api.stocks.listStocks,
    token
      ? {
          search: search || undefined,
          tag: tag || undefined,
          sortBy,
          sortOrder,
          token,
        }
      : "skip",
  );
}

export function useStock(id: GenericId<"stocks">) {
  const token = useAuthToken();
  return useQuery(api.stocks.getStock, token ? { id, token } : "skip");
}

export function useStockByTicker(ticker: string) {
  const token = useAuthToken();
  return useQuery(api.stocks.getStockByTicker, token ? { ticker, token } : "skip");
}

export function useTags() {
  const token = useAuthToken();
  return useQuery(api.stocks.listTags, token ? { token } : "skip");
}

// --- Mutation Hooks ---

export function useAddStock() {
  const token = useAuthToken();
  const mutation = useMutation(api.stocks.addStock);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useUpdateStock() {
  const token = useAuthToken();
  const mutation = useMutation(api.stocks.updateStock);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useDeleteStock() {
  const token = useAuthToken();
  const mutation = useMutation(api.stocks.deleteStock);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}
