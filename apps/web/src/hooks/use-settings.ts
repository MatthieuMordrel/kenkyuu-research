import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";

// --- Query Hooks ---

export function useSettings(key: string) {
  return useQuery(api.settings.getSetting, { key });
}

// --- Mutation Hooks ---

export function useUpdateSetting() {
  return useMutation(api.settings.upsertSetting);
}
