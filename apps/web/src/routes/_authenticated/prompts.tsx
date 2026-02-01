import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prompts")({
  component: PromptsPage,
});

function PromptsPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Prompts</h1>
      <p className="text-muted-foreground mt-2">Manage research prompt templates</p>
    </div>
  );
}
