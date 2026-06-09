import { useQuery } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";
import { useAuthToken } from "@/lib/auth";
import { useCallback } from "react";

// --- Query Hooks ---

export function useSchedules() {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(
      api.schedules.queries.listSchedules.listSchedules,
      token ? { token } : "skip"
    )
  );
  return data;
}

export function useSchedule(id: GenericId<"schedules">) {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(
      api.schedules.queries.getSchedule.getSchedule,
      token ? { id, token } : "skip"
    )
  );
  return data;
}

export function useUpcomingRuns(limit?: number) {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(
      api.schedules.queries.getUpcomingRuns.getUpcomingRuns,
      token ? { limit: limit || undefined, token } : "skip"
    )
  );
  return data;
}

export function useScheduleHistory(
  scheduleId: GenericId<"schedules">,
  limit?: number
) {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(
      api.schedules.queries.getScheduleHistory.getScheduleHistory,
      token ? { scheduleId, limit: limit || undefined, token } : "skip"
    )
  );
  return data;
}

export function useGlobalPauseStatus() {
  const token = useAuthToken();
  const { data } = useQuery(
    convexQuery(
      api.schedules.queries.getGlobalPauseStatus.getGlobalPauseStatus,
      token ? { token } : "skip"
    )
  );
  return data;
}

// --- Mutation Hooks ---

export function useCreateSchedule() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.schedules.mutations.createSchedule.createSchedule
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useUpdateSchedule() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.schedules.mutations.updateSchedule.updateSchedule
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useDeleteSchedule() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.schedules.mutations.deleteSchedule.deleteSchedule
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useRunScheduleNow() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.schedules.mutations.runScheduleNow.runScheduleNow
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useToggleSchedule() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.schedules.mutations.toggleSchedule.toggleSchedule
  );
  return useCallback(
    (args: Omit<Parameters<typeof mutation>[0], "token">) =>
      mutation({ ...args, token: token ?? undefined }),
    [mutation, token]
  );
}

export function useToggleGlobalPause() {
  const token = useAuthToken();
  const mutation = useConvexMutation(
    api.schedules.mutations.toggleGlobalPause.toggleGlobalPause
  );
  return useCallback(
    () => mutation({ token: token ?? undefined }),
    [mutation, token]
  );
}
