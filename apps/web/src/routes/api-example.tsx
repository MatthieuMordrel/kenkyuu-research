import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
  // Query for the root endpoint
  const helloQuery = useQuery({
    queryKey: ["hello"],
    queryFn: async () => {
      const { data, error } = await api.get();
      if (error) throw error;
      return data as string;
    },
    enabled: false, // Don't fetch automatically
  });

  // Query for the health endpoint
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.health.get();
      if (error) throw error;
      return data as { status: string };
    },
    enabled: false, // Don't fetch automatically
  });

  const error = helloQuery.error || healthQuery.error;
  const isLoading = helloQuery.isFetching || healthQuery.isFetching;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Eden API Example</h1>
        <p className="text-muted-foreground">
          This page demonstrates calling the Elysia API using TanStack Query
          with the type-safe Eden client.
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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>GET /</CardTitle>
              <CardDescription>Fetch the hello message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => helloQuery.refetch()} disabled={isLoading}>
                {helloQuery.isFetching ? "Loading..." : "Fetch Hello"}
              </Button>
              {helloQuery.data && (
                <div className="rounded-md bg-muted p-4">
                  <code>{helloQuery.data}</code>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GET /health</CardTitle>
              <CardDescription>Check API health status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => healthQuery.refetch()}
                disabled={isLoading}
                variant="secondary"
              >
                {healthQuery.isFetching ? "Loading..." : "Check Health"}
              </Button>
              {healthQuery.data && (
                <div className="rounded-md bg-muted p-4">
                  <code>{JSON.stringify(healthQuery.data, null, 2)}</code>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Code Example</CardTitle>
            <CardDescription>
              How to use TanStack Query with Eden
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
              <code>{`import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Query that fetches on mount
const { data, error, isLoading } = useQuery({
  queryKey: ["health"],
  queryFn: async () => {
    const { data, error } = await api.health.get();
    if (error) throw error;
    return data;
  },
});

// Query that fetches on demand
const query = useQuery({
  queryKey: ["hello"],
  queryFn: async () => {
    const { data, error } = await api.get();
    if (error) throw error;
    return data;
  },
  enabled: false, // Don't auto-fetch
});

// Trigger fetch manually
query.refetch();`}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
