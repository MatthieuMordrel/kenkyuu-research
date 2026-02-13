import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useState, useCallback } from "react";
import { useAuthToken } from "@/lib/auth";

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
  const token = useAuthToken();
  const { status, stockId, promptId, dateFrom, dateTo, pageSize = 20 } = options;
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const data = useQuery(
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
      : "skip",
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

export function useSearchResults(searchTerm: string, limit?: number) {
  const token = useAuthToken();
  return useQuery(
    api.researchJobs.searchResults,
    token && searchTerm.length > 0 ? { searchTerm, limit, token } : "skip",
  );
}

export function useFavoriteResults() {
  const token = useAuthToken();
  return useQuery(api.researchJobs.listFavorites, token ? { token } : "skip");
}

// --- Mutation Hooks ---

export function useToggleFavorite() {
  const token = useAuthToken();
  const mutation = useMutation(api.researchJobs.toggleFavorite);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}
