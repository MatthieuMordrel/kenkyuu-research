import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";

// --- Query Hooks ---

interface UseStocksOptions {
  search?: string;
  tag?: string;
  sortBy?: "ticker" | "companyName" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export function useStocks(options: UseStocksOptions = {}) {
  const { search, tag, sortBy, sortOrder } = options;
  return useQuery(api.stocks.listStocks, {
    search: search || undefined,
    tag: tag || undefined,
    sortBy,
    sortOrder,
  });
}

export function useStock(id: GenericId<"stocks">) {
  return useQuery(api.stocks.getStock, { id });
}

export function useStockByTicker(ticker: string) {
  return useQuery(api.stocks.getStockByTicker, { ticker });
}

export function useTags() {
  return useQuery(api.stocks.listTags);
}

// --- Mutation Hooks ---

export function useAddStock() {
  return useMutation(api.stocks.addStock);
}

export function useUpdateStock() {
  return useMutation(api.stocks.updateStock);
}

export function useDeleteStock() {
  return useMutation(api.stocks.deleteStock);
}
