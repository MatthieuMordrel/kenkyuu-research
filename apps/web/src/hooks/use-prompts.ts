import { useQuery, useMutation } from "convex/react";
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
  return useQuery(
    api.prompts.listPrompts,
    token
      ? { type: type || undefined, token }
      : "skip",
  );
}

export function usePrompt(id: GenericId<"prompts">) {
  const token = useAuthToken();
  return useQuery(api.prompts.getPrompt, token ? { id, token } : "skip");
}

// --- Mutation Hooks ---

export function useCreatePrompt() {
  const token = useAuthToken();
  const mutation = useMutation(api.prompts.createPrompt);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useUpdatePrompt() {
  const token = useAuthToken();
  const mutation = useMutation(api.prompts.updatePrompt);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useDeletePrompt() {
  const token = useAuthToken();
  const mutation = useMutation(api.prompts.deletePrompt);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useClonePrompt() {
  const token = useAuthToken();
  const mutation = useMutation(api.prompts.clonePrompt);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}
