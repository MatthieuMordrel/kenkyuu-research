import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ResearchWizard } from "@/components/research-wizard";
import { ActiveJobsPanel } from "@/components/active-jobs-panel";
import { useResearchFlow } from "@/hooks/use-research-flow";
import { useResearchJobs } from "@/hooks/use-research";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/research")({
  component: ResearchPage,
});

function ResearchPage() {
  const flow = useResearchFlow();
  const recentJobs = useResearchJobs();
  const isLoading = recentJobs === undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Research"
        description="Run AI-powered deep research on your stocks"
        actions={
          <Button size="sm" onClick={flow.open}>
            <Plus className="size-4" />
            New Research
          </Button>
        }
      />

      <div className="flex flex-col gap-4 px-4 md:px-6 pb-4">
        {/* Active jobs panel */}
        <ActiveJobsPanel />

        {/* Recent completed/failed jobs */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">
            Recent Jobs
          </h2>
          {isLoading ? (
            <ListSkeleton count={3} />
          ) : recentJobs.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No research jobs yet"
              description="Start your first research to see results here."
              action={
                <Button size="sm" onClick={flow.open}>
                  <Plus className="size-4" />
                  New Research
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recentJobs.slice(0, 10).map((job) => (
                <Card key={job._id} className="py-3">
                  <CardContent className="flex items-center gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          Job
                        </span>
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "secondary"
                              : job.status === "failed"
                                ? "destructive"
                                : "outline"
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {job.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {job.stockIds.length} stock{job.stockIds.length !== 1 ? "s" : ""} ·{" "}
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Research wizard dialog */}
      <ResearchWizard />
    </div>
  );
}
