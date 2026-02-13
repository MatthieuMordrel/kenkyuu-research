import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { ErrorBoundary } from "@/components/error-boundary";
import { lazy, Suspense } from "react";

const DevtoolsLazy = lazy(() =>
  import("@tanstack/react-devtools").then((mod) => ({
    default: mod.TanStackDevtools,
  })),
);

const RouterDevtoolsPanelLazy = lazy(() =>
  import("@tanstack/react-router-devtools").then((mod) => ({
    default: mod.TanStackRouterDevtoolsPanel,
  })),
);

const ReactQueryDevtoolsLazy = lazy(() =>
  import("@tanstack/react-query-devtools").then((mod) => ({
    default: mod.ReactQueryDevtools,
  })),
);

function Devtools() {
  if (!import.meta.env.DEV) return null;

  return (
    <Suspense>
      <DevtoolsLazy
        config={{ position: "bottom-right" as const }}
        plugins={[
          {
            name: "Tanstack Router",
            render: <RouterDevtoolsPanelLazy />,
          },
        ]}
      />
      <ReactQueryDevtoolsLazy initialIsOpen={false} />
    </Suspense>
  );
}

export const Route = createRootRoute({
  component: () => (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Devtools />
      </QueryClientProvider>
    </ErrorBoundary>
  ),
});
