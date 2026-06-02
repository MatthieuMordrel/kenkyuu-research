import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useResearchJob, useDeleteJob } from "@/hooks/use-research";
import { useToggleFavorite } from "@/hooks/use-research-history";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { PromptPreviewDialog } from "@/components/prompt-preview-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getResearchModelLabel, resolvePromptModelId } from "@/lib/research-flow";
import type { GenericId } from "convex/values";

export const Route = createFileRoute("/_authenticated/research/$jobId")({
  component: ResultDetailPage,
});

const statusConfig: Record<
  string,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    label: string;
  }
> = {
  completed: { variant: "secondary", label: "Completed" },
  failed: { variant: "destructive", label: "Failed" },
  running: { variant: "outline", label: "Running" },
  pending: { variant: "outline", label: "Pending" },
};

function ResultDetailPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const job = useResearchJob(jobId as GenericId<"researchJobs">);
  const toggleFavorite = useToggleFavorite();
  const deleteJob = useDeleteJob();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  async function confirmDelete() {
    try {
      await deleteJob({ id: jobId as GenericId<"researchJobs"> });
      navigate({ to: "/research" });
    } finally {
      setShowDeleteDialog(false);
    }
  }

  if (job === undefined) {
    return <PageSkeleton />;
  }

  if (job === null) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-4">
        <div className="px-4 pt-4 md:px-6">
          <Button variant="ghost" size="sm" render={<Link to="/research" />}>
            <ArrowLeft className="size-4" />
            Back to Research
          </Button>
        </div>
        <EmptyState
          icon={FlaskConical}
          title="Result not found"
          description="This research result may have been deleted."
          action={
            <Button size="sm" render={<Link to="/research" />}>
              Back to Research
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

  const costStr =
    job.costUsd != null ? `$${job.costUsd.toFixed(2)}` : undefined;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {/* Back link */}
      <div className="px-4 pt-4 md:px-6">
        <Button variant="ghost" size="sm" render={<Link to="/research" />}>
          <ArrowLeft className="size-4" />
          Back to Research
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
                  job.isFavorited ? "fill-yellow-400 text-yellow-400" : ""
                )}
              />
              {job.isFavorited ? "Favorited" : "Favorite"}
            </Button>
            {job.status !== "pending" && job.status !== "running" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="flex w-full min-w-0 flex-col gap-4 px-4 pb-4 md:px-6">
        {/* Metadata cards */}
        <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4">
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
          <MetadataCard icon={DollarSign} label="Cost" value={costStr ?? "—"} />
          <MetadataCard
            icon={Cpu}
            label="Model"
            value={getResearchModelLabel(
              resolvePromptModelId({
                defaultModelId: job.modelId,
                defaultProvider: job.provider,
              })
            )}
          />
        </div>

        {/* Timing details */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-4" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <dl className="flex flex-col gap-2 text-sm">
              <DetailRow label="Started" value={`${createdDate} at ${createdTime}`} />
              {completedDate && (
                <DetailRow
                  label="Completed"
                  value={`${completedDate} at ${completedTime}`}
                />
              )}
              <DetailRow
                label="Stocks analyzed"
                value={String(job.stockIds.length)}
              />
              <DetailRow label="Attempts" value={String(job.attempts)} />
            </dl>
          </CardContent>
        </Card>

        {/* Prompt Used — prefer resolvedPrompt (exact), fall back to promptSnapshot (template) */}
        {(job.resolvedPrompt || job.promptSnapshot) && (
          <PromptPreviewDialog
            content={job.resolvedPrompt ?? job.promptSnapshot ?? ""}
            label="Prompt Used"
          />
        )}

        {/* Error message */}
        {job.error && (
          <Card className="min-w-0 border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertCircle className="size-4" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <p className="text-sm break-words whitespace-pre-wrap">
                {job.error}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Research result content */}
        {job.result && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="size-4" />
                Research Output
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 max-w-full overflow-x-auto">
              <MarkdownRenderer
                content={job.result}
                outlineControlsStickyTopClassName="top-14 md:top-0"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => !open && setShowDeleteDialog(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Research Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this research job? This will also
              remove all associated cost logs. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Label/value row in the Details card; stacks on narrow screens so dates do not overflow.
 */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words sm:text-right">{value}</dd>
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
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </div>
      <div className="min-w-0 text-sm font-medium break-words">{value}</div>
    </div>
  );
}
