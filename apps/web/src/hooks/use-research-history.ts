import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useState, useCallback } from "react";
import { useAuthToken } from "@/lib/auth";

// --- Types ---

type JobStatus = "pending" | "running" | "formatting" | "completed" | "failed";

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
  const token = useAuthToken();
  const {
    status,
    stockId,
    promptId,
    dateFrom,
    dateTo,
    pageSize = 20,
  } = options;
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { data } = useQuery(
    convexQuery(
      api.researchJobs.listResults,
      token
        ? {
            status: status ?? undefined,
            stockId: stockId ?? undefined,
            promptId: promptId ?? undefined,
            dateFrom: dateFrom ?? undefined,
            dateTo: dateTo ?? undefined,
            cursor,
            limit: pageSize,
            token,
          }
        : "skip"
    )
  );

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

export function useSearchResults(searchTerm: string, limit = 100) {
  const token = useAuthToken();
  const trimmedSearchTerm = searchTerm.trim();
  const { data } = useQuery(
    convexQuery(
      api.researchJobs.searchResults,
      token && trimmedSearchTerm.length > 0
        ? { searchTerm: trimmedSearchTerm, limit, token }
        : "skip"
    )
  );
  return data;
}

export function useFavoriteResults() {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(api.researchJobs.listFavorites, token ? { token } : "skip")
  );
  return data;
}

// --- Mutation Hooks ---

export function useToggleFavorite() {
  const token = useAuthToken();
  const mutation = useConvexMutation(api.researchJobs.toggleFavorite);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}
