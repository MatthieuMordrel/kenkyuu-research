import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/research")({
  component: ResearchLayout,
});

function ResearchLayout() {
  return <Outlet />;
}
