import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Types (inferred from Elysia API, but explicit for clarity)
interface HealthResponse {
  status: string;
}

// Query Key Factory (hierarchical structure)
const apiKeys = {
  all: ["api"] as const,
  hello: () => [...apiKeys.all, "hello"] as const,
  health: () => [...apiKeys.all, "health"] as const,
};

// Query Functions (private - not exported)
const fetchHello = async (): Promise<string> => {
  const { data, error } = await api.get();
  if (error) throw error;
  return data as string;
};

const fetchHealth = async (): Promise<HealthResponse> => {
  const { data, error } = await api.health.get();
  if (error) throw error;
  return data as HealthResponse;
};

// Query Options (for type-safe imperative access)
export const helloOptions = () =>
  queryOptions({
    queryKey: apiKeys.hello(),
    queryFn: fetchHello,
    staleTime: 30_000,
  });

export const healthOptions = () =>
  queryOptions({
    queryKey: apiKeys.health(),
    queryFn: fetchHealth,
    staleTime: 10_000,
  });

// Custom Hooks (public API - only export these)
export const useHello = () => {
  return useQuery(helloOptions());
};

export const useHealth = () => {
  return useQuery(healthOptions());
};

// Atomic selector for health status only
export const useHealthStatus = () => {
  return useQuery({
    ...healthOptions(),
    select: (data) => data.status,
  });
};
