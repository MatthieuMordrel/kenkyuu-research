import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/schedules")({
  component: SchedulesPage,
});

function SchedulesPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Schedules</h1>
      <p className="text-muted-foreground mt-2">Manage automated research schedules</p>
    </div>
  );
}
