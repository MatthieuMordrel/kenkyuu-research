import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/research")({
  component: ResearchPage,
});

function ResearchPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Research</h1>
      <p className="text-muted-foreground mt-2">View research history and results</p>
    </div>
  );
}
