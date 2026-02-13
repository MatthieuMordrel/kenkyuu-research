import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useAuthToken } from "@/lib/auth";
import { useCallback } from "react";

// --- Query Hooks ---

export function useSchedules() {
  const token = useAuthToken();
  return useQuery(api.schedules.listSchedules, token ? { token } : "skip");
}

export function useSchedule(id: GenericId<"schedules">) {
  const token = useAuthToken();
  return useQuery(api.schedules.getSchedule, token ? { id, token } : "skip");
}

export function useUpcomingRuns(limit?: number) {
  const token = useAuthToken();
  return useQuery(
    api.schedules.getUpcomingRuns,
    token
      ? { limit: limit || undefined, token }
      : "skip",
  );
}

export function useScheduleHistory(
  scheduleId: GenericId<"schedules">,
  limit?: number,
) {
  const token = useAuthToken();
  return useQuery(
    api.schedules.getScheduleHistory,
    token
      ? { scheduleId, limit: limit || undefined, token }
      : "skip",
  );
}

export function useGlobalPauseStatus() {
  const token = useAuthToken();
  return useQuery(api.schedules.getGlobalPauseStatus, token ? { token } : "skip");
}

// --- Mutation Hooks ---

export function useCreateSchedule() {
  const token = useAuthToken();
  const mutation = useMutation(api.schedules.createSchedule);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useUpdateSchedule() {
  const token = useAuthToken();
  const mutation = useMutation(api.schedules.updateSchedule);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useDeleteSchedule() {
  const token = useAuthToken();
  const mutation = useMutation(api.schedules.deleteSchedule);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useToggleSchedule() {
  const token = useAuthToken();
  const mutation = useMutation(api.schedules.toggleSchedule);
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token],
  );
}

export function useToggleGlobalPause() {
  const token = useAuthToken();
  const mutation = useMutation(api.schedules.toggleGlobalPause);
  return useCallback(
    () => mutation({ token: token ?? undefined }),
    [mutation, token],
  );
}
