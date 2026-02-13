import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useAuthToken } from "@/lib/auth";
import { useCallback } from "react";

// --- Query Hooks ---

type JobStatus = "pending" | "running" | "completed" | "failed";

interface UseResearchJobsOptions {
  status?: JobStatus;
  stockId?: GenericId<"stocks">;
  promptId?: GenericId<"prompts">;
}

export function useResearchJobs(options: UseResearchJobsOptions = {}) {
  const token = useAuthToken();
  const { status, stockId, promptId } = options;
  return useQuery(
    api.researchJobs.listJobs,
    token
      ? {
          status: status || undefined,
          stockId: stockId || undefined,
          promptId: promptId || undefined,
          token,
        }
      : "skip",
  );
}

export function useResearchJob(id: GenericId<"researchJobs">) {
  const token = useAuthToken();
  return useQuery(api.researchJobs.getJob, token ? { id, token } : "skip");
}

export function useActiveJobs() {
  const token = useAuthToken();
  return useQuery(api.researchJobs.getActiveJobs, token ? { token } : "skip");
}

// --- Mutation Hooks ---

export function useStartResearch() {
  const token = useAuthToken();
  const mutation = useMutation(api.researchJobs.createAndStartResearch);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useCancelJob() {
  const token = useAuthToken();
  const mutation = useMutation(api.researchJobs.cancelJob);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useRetryJob() {
  const token = useAuthToken();
  const mutation = useMutation(api.researchJobs.retryJob);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useDeleteJob() {
  const token = useAuthToken();
  const mutation = useMutation(api.researchJobs.deleteJob);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}
