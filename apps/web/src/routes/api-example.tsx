import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useHello,
  useHealth,
  helloOptions,
  healthOptions,
} from "@/examples/elysia-tanstack-query-example";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/api-example")({
  component: ApiExample,
});

function ApiExample() {
  const queryClient = useQueryClient();

  // Using custom hooks from our example (auto-fetch on mount)
  const { data: helloData, error: helloError, isPending: helloPending, isFetching: helloFetching } = useHello();
  const { data: healthData, error: healthError, isPending: healthPending, isFetching: healthFetching } = useHealth();

  const error = helloError || healthError;
  const isPending = helloPending || healthPending;

  // Prefetch handlers for hover optimization
  const prefetchHello = useCallback(
    () => queryClient.prefetchQuery(helloOptions()),
    [queryClient]
  );
  const prefetchHealth = useCallback(
    () => queryClient.prefetchQuery(healthOptions()),
    [queryClient]
  );

  // Invalidate to trigger refetch
  const invalidateHello = useCallback(
    () => queryClient.invalidateQueries({ queryKey: helloOptions().queryKey }),
    [queryClient]
  );
  const invalidateHealth = useCallback(
    () => queryClient.invalidateQueries({ queryKey: healthOptions().queryKey }),
    [queryClient]
  );

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Eden API Example</h1>
        <p className="text-muted-foreground">
          This page demonstrates calling the Elysia API using TanStack Query
          with the type-safe Eden client, following best practices.
        </p>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                {error instanceof Error ? error.message : "Failed to fetch"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Make sure the Elysia server is running:{" "}
                <code>bun run dev:elysia</code>
              </p>
            </CardContent>
          </Card>
        )}

        {isPending && !error && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading...
            </CardContent>
          </Card>
        )}

        {!isPending && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>GET /</CardTitle>
                <CardDescription>Hello message (auto-fetched)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={invalidateHello}
                  onMouseEnter={prefetchHello}
                  disabled={helloFetching}
                >
                  {helloFetching ? "Refreshing..." : "Refresh"}
                </Button>
                {helloData && (
                  <div className="rounded-md bg-muted p-4">
                    <code>{helloData}</code>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>GET /health</CardTitle>
                <CardDescription>Health status (auto-fetched)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={invalidateHealth}
                  onMouseEnter={prefetchHealth}
                  disabled={healthFetching}
                  variant="secondary"
                >
                  {healthFetching ? "Refreshing..." : "Refresh"}
                </Button>
                {healthData && (
                  <div className="rounded-md bg-muted p-4">
                    <code>{JSON.stringify(healthData, null, 2)}</code>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Best Practices Pattern</CardTitle>
            <CardDescription>
              Query keys, options, and hooks in a separate file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
              <code>{`// examples/elysia-tanstack-query-example.ts

// 1. Query Key Factory (hierarchical)
const apiKeys = {
  all: ["api"] as const,
  hello: () => [...apiKeys.all, "hello"] as const,
  health: () => [...apiKeys.all, "health"] as const,
};

// 2. Private Query Functions
const fetchHello = async (): Promise<string> => {
  const { data, error } = await api.index.get();
  if (error) throw error;
  return data as string;
};

// 3. Query Options (for type-safe imperative access)
export const helloOptions = () =>
  queryOptions({
    queryKey: apiKeys.hello(),
    queryFn: fetchHello,
    staleTime: 30_000,
  });

// 4. Custom Hooks (public API)
export const useHello = () => useQuery(helloOptions());

// Usage in component:
const { data, isPending, error } = useHello();

// Prefetch on hover:
queryClient.prefetchQuery(helloOptions());

// Invalidate to refetch:
queryClient.invalidateQueries({ queryKey: helloOptions().queryKey });`}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
