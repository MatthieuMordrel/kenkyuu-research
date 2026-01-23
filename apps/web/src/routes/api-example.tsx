import { createFileRoute } from "@tanstack/react-router";
import { usePosts, usePost } from "@/examples/tanstack-query-example";
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
  const { data: posts, isPending, error } = usePosts();
  const { data: firstPost } = usePost(1);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">TanStack Query Example</h1>
        <p className="text-muted-foreground">
          Fetching from JSONPlaceholder using best practices pattern.
        </p>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent>
              {error instanceof Error ? error.message : "Failed to fetch"}
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
      </div>
    </div>
  );
}
