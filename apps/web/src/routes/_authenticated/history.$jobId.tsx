import { createFileRoute, Link } from "@tanstack/react-router";
import { useResearchJob } from "@/hooks/use-research";
import { useToggleFavorite } from "@/hooks/use-research-history";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Star,
  Clock,
  DollarSign,
  Cpu,
  Calendar,
  AlertCircle,
  FlaskConical,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenericId } from "convex/values";

export const Route = createFileRoute("/_authenticated/history/$jobId")({
  component: ResultDetailPage,
});

const statusConfig: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  completed: { variant: "secondary", label: "Completed" },
  failed: { variant: "destructive", label: "Failed" },
  running: { variant: "outline", label: "Running" },
  pending: { variant: "outline", label: "Pending" },
};

function ResultDetailPage() {
  const { jobId } = Route.useParams();
  const job = useResearchJob(jobId as GenericId<"researchJobs">);
  const toggleFavorite = useToggleFavorite();

  if (job === undefined) {
    return <PageSkeleton />;
  }

  if (job === null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="px-4 pt-4 md:px-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/history">
              <ArrowLeft className="size-4" />
              Back to History
            </Link>
          </Button>
        </div>
        <EmptyState
          icon={FlaskConical}
          title="Result not found"
          description="This research result may have been deleted."
          action={
            <Button size="sm" asChild>
              <Link to="/history">Back to History</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const config = statusConfig[job.status] ?? statusConfig.pending;

  const createdDate = new Date(job.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const createdTime = new Date(job.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const completedDate = job.completedAt
    ? new Date(job.completedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : undefined;

  const completedTime = job.completedAt
    ? new Date(job.completedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : undefined;

  const durationStr = job.durationMs
    ? job.durationMs >= 60000
      ? `${Math.floor(job.durationMs / 60000)}m ${Math.round((job.durationMs % 60000) / 1000)}s`
      : `${Math.round(job.durationMs / 1000)}s`
    : undefined;

  const costStr = job.costUsd != null ? `$${job.costUsd.toFixed(2)}` : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <div className="px-4 pt-4 md:px-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/history">
            <ArrowLeft className="size-4" />
            Back to History
          </Link>
        </Button>
      </div>

      {/* Header */}
      <PageHeader
        title="Research Result"
        description={`${createdDate} at ${createdTime}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleFavorite({ id: job._id })}
            >
              <Star
                className={cn(
                  "size-4",
                  job.isFavorited
                    ? "fill-yellow-400 text-yellow-400"
                    : "",
                )}
              />
              {job.isFavorited ? "Favorited" : "Favorite"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 px-4 pb-4 md:px-6">
        {/* Metadata cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <MetadataCard
            icon={BarChart3}
            label="Status"
            value={
              <Badge variant={config.variant} className="text-xs">
                {config.label}
              </Badge>
            }
          />
          <MetadataCard
            icon={Clock}
            label="Duration"
            value={durationStr ?? "—"}
          />
          <MetadataCard
            icon={DollarSign}
            label="Cost"
            value={costStr ?? "—"}
          />
          <MetadataCard
            icon={Cpu}
            label="Provider"
            value={job.provider.toUpperCase()}
          />
        </div>

        {/* Timing details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-4" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Started</dt>
                <dd>{createdDate} at {createdTime}</dd>
              </div>
              {completedDate && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd>{completedDate} at {completedTime}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Stocks analyzed</dt>
                <dd>{job.stockIds.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Attempts</dt>
                <dd>{job.attempts}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Error message */}
        {job.error && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertCircle className="size-4" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{job.error}</p>
            </CardContent>
          </Card>
        )}

        {/* Research result content */}
        {job.result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="size-4" />
                Research Output
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownRenderer content={job.result} />
            </CardContent>
          </Card>
        )}

        {/* Prompt snapshot */}
        {job.promptSnapshot && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt Used</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs whitespace-pre-wrap">
                {job.promptSnapshot}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetadataCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium">
        {typeof value === "string" ? value : value}
      </div>
    </div>
  );
}
