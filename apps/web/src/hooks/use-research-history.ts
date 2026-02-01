import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useState, useCallback } from "react";

// --- Types ---

type JobStatus = "pending" | "running" | "completed" | "failed";

interface UseResearchHistoryOptions {
  status?: JobStatus;
  stockId?: GenericId<"stocks">;
  promptId?: GenericId<"prompts">;
  dateFrom?: number;
  dateTo?: number;
  pageSize?: number;
}

// --- Query Hooks ---

export function useResearchHistory(options: UseResearchHistoryOptions = {}) {
  const { status, stockId, promptId, dateFrom, dateTo, pageSize = 20 } = options;
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const data = useQuery(api.researchJobs.listResults, {
    status: status ?? undefined,
    stockId: stockId ?? undefined,
    promptId: promptId ?? undefined,
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
    cursor,
    limit: pageSize,
  });

  const loadMore = useCallback(() => {
    if (data && !data.isDone && data.cursor) {
      setCursor(data.cursor);
    }
  }, [data]);

  const reset = useCallback(() => {
    setCursor(undefined);
  }, []);

  return {
    results: data?.results,
    isLoading: data === undefined,
    isDone: data?.isDone ?? false,
    loadMore,
    reset,
  };
}

export function useSearchResults(searchTerm: string, limit?: number) {
  return useQuery(
    api.researchJobs.searchResults,
    searchTerm.length > 0 ? { searchTerm, limit } : "skip",
  );
}

export function useFavoriteResults() {
  return useQuery(api.researchJobs.listFavorites);
}

// --- Mutation Hooks ---

export function useToggleFavorite() {
  return useMutation(api.researchJobs.toggleFavorite);
}
