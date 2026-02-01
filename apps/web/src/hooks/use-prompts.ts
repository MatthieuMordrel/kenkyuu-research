import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";

// --- Query Hooks ---

type PromptType = "single-stock" | "multi-stock" | "discovery";

interface UsePromptsOptions {
  type?: PromptType;
}

export function usePrompts(options: UsePromptsOptions = {}) {
  const { type } = options;
  return useQuery(api.prompts.listPrompts, {
    type: type || undefined,
  });
}

export function usePrompt(id: GenericId<"prompts">) {
  return useQuery(api.prompts.getPrompt, { id });
}

// --- Mutation Hooks ---

export function useCreatePrompt() {
  return useMutation(api.prompts.createPrompt);
}

export function useUpdatePrompt() {
  return useMutation(api.prompts.updatePrompt);
}

export function useDeletePrompt() {
  return useMutation(api.prompts.deletePrompt);
}

export function useClonePrompt() {
  return useMutation(api.prompts.clonePrompt);
}
