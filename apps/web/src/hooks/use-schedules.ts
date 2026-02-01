import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { GenericId } from "convex/values";

// --- Query Hooks ---

export function useSchedules() {
  return useQuery(api.schedules.listSchedules, {});
}

export function useSchedule(id: GenericId<"schedules">) {
  return useQuery(api.schedules.getSchedule, { id });
}

export function useUpcomingRuns(limit?: number) {
  return useQuery(api.schedules.getUpcomingRuns, {
    limit: limit || undefined,
  });
}

export function useScheduleHistory(
  scheduleId: GenericId<"schedules">,
  limit?: number,
) {
  return useQuery(api.schedules.getScheduleHistory, {
    scheduleId,
    limit: limit || undefined,
  });
}

export function useGlobalPauseStatus() {
  return useQuery(api.schedules.getGlobalPauseStatus, {});
}

// --- Mutation Hooks ---

export function useCreateSchedule() {
  return useMutation(api.schedules.createSchedule);
}

export function useUpdateSchedule() {
  return useMutation(api.schedules.updateSchedule);
}

export function useDeleteSchedule() {
  return useMutation(api.schedules.deleteSchedule);
}

export function useToggleSchedule() {
  return useMutation(api.schedules.toggleSchedule);
}

export function useToggleGlobalPause() {
  return useMutation(api.schedules.toggleGlobalPause);
}
