import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  const [response, setResponse] = useState<string | null>(null);
  const [health, setHealth] = useState<{ status: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHello = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await api.get();
      if (error) throw error;
      setResponse(data as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await api.health.get();
      if (error) throw error;
      setHealth(data as { status: string });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Eden API Example</h1>
        <p className="text-muted-foreground">
          This page demonstrates calling the Elysia API using the type-safe Eden
          client.
        </p>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Make sure the Elysia server is running: <code>bun run dev:elysia</code>
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
              <Button onClick={fetchHello} disabled={loading}>
                {loading ? "Loading..." : "Fetch Hello"}
              </Button>
              {response && (
                <div className="rounded-md bg-muted p-4">
                  <code>{response}</code>
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
              <Button onClick={fetchHealth} disabled={loading} variant="secondary">
                {loading ? "Loading..." : "Check Health"}
              </Button>
              {health && (
                <div className="rounded-md bg-muted p-4">
                  <code>{JSON.stringify(health, null, 2)}</code>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Code Example</CardTitle>
            <CardDescription>How to use the Eden client</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
              <code>{`import { api } from "@/lib/api";

// GET / (root)
const { data, error } = await api.get();

// GET /health
const { data } = await api.health.get();

// The client is fully type-safe!
// TypeScript knows the response types.`}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
