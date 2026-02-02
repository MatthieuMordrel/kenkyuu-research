import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import { useAuthToken } from "@/lib/auth";
import { useCallback } from "react";

// --- Query Hooks ---

export function useSettings(key: string) {
  const token = useAuthToken();
  return useQuery(
    api.settings.getSetting,
    token ? { key, token } : "skip",
  );
}

// --- Mutation Hooks ---

export function useUpdateSetting() {
  const token = useAuthToken();
  const mutation = useMutation(api.settings.upsertSetting);

  return useCallback(
    async (args: { key: string; value: string }) => {
      if (!token) throw new Error("Not authenticated");
      return mutation({ ...args, token });
    },
    [mutation, token],
  );
}
