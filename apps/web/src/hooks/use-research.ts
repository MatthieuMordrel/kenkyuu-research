import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";

// --- Query Hooks ---

type JobStatus = "pending" | "running" | "completed" | "failed";

interface UseResearchJobsOptions {
  status?: JobStatus;
  stockId?: GenericId<"stocks">;
  promptId?: GenericId<"prompts">;
}

export function useResearchJobs(options: UseResearchJobsOptions = {}) {
  const { status, stockId, promptId } = options;
  return useQuery(api.researchJobs.listJobs, {
    status: status || undefined,
    stockId: stockId || undefined,
    promptId: promptId || undefined,
  });
}

export function useResearchJob(id: GenericId<"researchJobs">) {
  return useQuery(api.researchJobs.getJob, { id });
}

export function useActiveJobs() {
  return useQuery(api.researchJobs.getActiveJobs);
}

// --- Mutation Hooks ---

export function useStartResearch() {
  return useMutation(api.researchJobs.createAndStartResearch);
}

export function useCancelJob() {
  return useMutation(api.researchJobs.cancelJob);
}

export function useRetryJob() {
  return useMutation(api.researchJobs.retryJob);
}

export function useDeleteJob() {
  return useMutation(api.researchJobs.deleteJob);
}
