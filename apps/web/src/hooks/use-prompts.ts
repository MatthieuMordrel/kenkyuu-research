import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useAuthToken } from "@/lib/auth";
import { useCallback } from "react";

// --- Query Hooks ---

type PromptType = "single-stock" | "multi-stock" | "discovery";

interface UsePromptsOptions {
  type?: PromptType;
}

export function usePrompts(options: UsePromptsOptions = {}) {
  const token = useAuthToken();
  const { type } = options;
  const { data } = useQuery(
    convexQuery(
      api.prompts.queries.listPrompts.listPrompts,
      token ? { type: type || undefined, token } : "skip"
    )
  );
  return data;
}

export function usePrompt(id: GenericId<"prompts">) {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(
      api.prompts.queries.getPrompt.getPrompt,
      token ? { id, token } : "skip"
    )
  );
  return data;
}

// --- Mutation Hooks ---

export function useCreatePrompt() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.prompts.mutations.createPrompt.createPrompt
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useUpdatePrompt() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.prompts.mutations.updatePrompt.updatePrompt
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useDeletePrompt() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.prompts.mutations.deletePrompt.deletePrompt
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useClonePrompt() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.prompts.mutations.clonePrompt.clonePrompt
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}
