import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query-client";

const devtoolsConfig = { position: "bottom-right" as const };
const devtoolsPlugins = [
  {
    name: "Tanstack Router",
    render: <TanStackRouterDevtoolsPanel />,
  },
];

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <TanStackDevtools config={devtoolsConfig} plugins={devtoolsPlugins} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  ),
});
