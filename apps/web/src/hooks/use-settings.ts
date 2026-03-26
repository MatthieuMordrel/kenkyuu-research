import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@repo/convex";
import { useAuthToken } from "@/lib/auth";
import { useCallback } from "react";

// --- Query Hooks ---

export function useSettings(key: string) {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(api.settings.getSetting, token ? { key, token } : "skip"),
  );
  return data;
}

// --- Mutation Hooks ---

export function useUpdateSetting() {
  const token = useAuthToken();
  const mutation = useConvexMutation(api.settings.upsertSetting);

  return useCallback(
    async (args: { key: string; value: string }) => {
      if (!token) throw new Error("Not authenticated");
      return mutation({ ...args, token });
    },
    [mutation, token],
  );
}
