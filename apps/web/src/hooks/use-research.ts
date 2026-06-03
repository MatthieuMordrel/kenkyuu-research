import { useQuery } from "@tanstack/react-query";
import {
  convexQuery,
  useConvexMutation,
  useConvexAction,
} from "@convex-dev/react-query";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useAuthToken } from "@/lib/auth";
import { useCallback } from "react";

// --- Query Hooks ---

type JobStatus =
  | "pending"
  | "running"
  | "formatting"
  | "completed"
  | "failed";

interface UseResearchJobsOptions {
  status?: JobStatus;
  stockId?: GenericId<"stocks">;
  promptId?: GenericId<"prompts">;
}

export function useResearchJobs(options: UseResearchJobsOptions = {}) {
  const token = useAuthToken();
  const { status, stockId, promptId } = options;
  const { data } = useQuery(
    convexQuery(
      api.researchJobs.listJobs,
      token
        ? {
            status: status || undefined,
            stockId: stockId || undefined,
            promptId: promptId || undefined,
            token,
          }
        : "skip"
    )
  );
  return data;
}

export function useResearchJob(id: GenericId<"researchJobs">) {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(api.researchJobs.getJob, token ? { id, token } : "skip")
  );
  return data;
}

export function useActiveJobs() {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(api.researchJobs.getActiveJobs, token ? { token } : "skip")
  );
  return data;
}

// --- Mutation Hooks ---

export function useStartResearch() {
  const token = useAuthToken();
  const mutation = useConvexMutation(api.researchJobs.createAndStartResearch);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useCancelJob() {
  const token = useAuthToken();
  const mutation = useConvexMutation(api.researchJobs.cancelJob);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useRetryJob() {
  const token = useAuthToken();
  const mutation = useConvexMutation(api.researchJobs.retryJob);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useCheckJobHealth() {
  const token = useAuthToken();
  const checkHealth = useConvexAction(api.researchActions.checkJobHealth);
  return useCallback(
    (args: { jobId: GenericId<"researchJobs"> }) =>
      checkHealth({ jobId: args.jobId, token: token ?? undefined }),
    [checkHealth, token]
  );
}

export function useDeleteJob() {
  const token = useAuthToken();
  const mutation = useConvexMutation(api.researchJobs.deleteJob);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}
