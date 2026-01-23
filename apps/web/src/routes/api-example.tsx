import { createFileRoute } from "@tanstack/react-router";
import { usePosts, usePost } from "@/examples/tanstack-query-example";
import { useHello, useHealth } from "@/examples/elysia-tanstack-query-example";
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
  // Elysia API
  const { data: helloData, error: helloError } = useHello();
  const { data: healthData, error: healthError } = useHealth();

  // JSONPlaceholder API
  const { data: posts, isPending, error: postsError } = usePosts();
  const { data: firstPost } = usePost(1);

  const elysiaError = helloError || healthError;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">TanStack Query Examples</h1>

        {/* Elysia API Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">TanStack Query + Elysia + Eden Client</h2>
          {elysiaError && (
            <Card className="border-destructive">
              <CardContent className="py-4">
                <p className="text-destructive">
                  Elysia server not running. Start with: <code>bun run dev:elysia</code>
                </p>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>GET /</CardTitle>
              </CardHeader>
              <CardContent>
                <code>{helloData ?? "—"}</code>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>GET /health</CardTitle>
              </CardHeader>
              <CardContent>
                <code>{healthData ? JSON.stringify(healthData) : "—"}</code>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* JSONPlaceholder Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">TanStack Query</h2>
          {postsError && (
            <Card className="border-destructive">
              <CardContent className="py-4 text-destructive">
                {postsError instanceof Error ? postsError.message : "Failed to fetch"}
              </CardContent>
            </Card>
          )}
          {isPending && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          )}
          {firstPost && (
            <Card>
              <CardHeader>
                <CardTitle>Single Post (id: 1)</CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold">{firstPost.title}</h3>
                <p className="text-muted-foreground">{firstPost.body}</p>
              </CardContent>
            </Card>
          )}
          {posts && (
            <Card>
              <CardHeader>
                <CardTitle>All Posts</CardTitle>
                <CardDescription>Showing 10 of {posts.length} posts</CardDescription>
              </CardHeader>
              <CardContent className="max-h-96 space-y-2 overflow-y-auto">
                {posts.slice(0, 10).map((post) => (
                  <div key={post.id} className="rounded-md bg-muted p-3">
                    <p className="text-sm font-medium">{post.title}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
