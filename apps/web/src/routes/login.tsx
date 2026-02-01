import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if already authenticated
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-muted-foreground text-sm">
        Login page placeholder
      </div>
    </div>
  );
}
