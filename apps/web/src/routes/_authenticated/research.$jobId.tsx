import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useResearchJob, useDeleteJob } from "@/hooks/use-research";
import { useToggleFavorite } from "@/hooks/use-research-history";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";
import { ResearchOutputSection } from "@/components/research-output-section";
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
  Star,
  Clock,
  DollarSign,
  Cpu,
  AlertCircle,
  FlaskConical,
  BarChart3,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getResearchModelLabel,
  getResearchToolUsageLabel,
  resolvePromptModelId,
} from "@/lib/research-flow";
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
  formatting: { variant: "outline", label: "Formatting" },
  failed: { variant: "destructive", label: "Failed" },
  running: { variant: "outline", label: "Running" },
  pending: { variant: "outline", label: "Queued" },
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

  const durationStr = job.durationMs
    ? job.durationMs >= 60000
      ? `${Math.floor(job.durationMs / 60000)}m ${Math.round((job.durationMs % 60000) / 1000)}s`
      : `${Math.round(job.durationMs / 1000)}s`
    : undefined;

  const costStr =
    job.costUsd != null ? `$${job.costUsd.toFixed(2)}` : undefined;

  const resolvedModelId = resolvePromptModelId({
    defaultModelId: job.modelId,
    defaultProvider: job.provider,
  });

  const modelLabel = getResearchModelLabel(resolvedModelId);

  const toolUsageStr = getResearchToolUsageLabel(
    resolvedModelId,
    job.toolCallCount
  );

  const stockCount = job.stockIds.length;

  const canDelete =
    job.status !== "pending" &&
    job.status !== "running" &&
    job.status !== "formatting";

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {/* Compact header: title + status, actions, and inline metadata strip */}
      <div className="flex w-full min-w-0 flex-col gap-3 border-b px-4 pt-4 pb-3 md:px-6 md:pt-5">
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                Research Result
              </h1>
              <Badge variant={config.variant} className="shrink-0 text-xs">
                {config.label}
              </Badge>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {createdDate} at {createdTime}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
            {(job.resolvedPrompt || job.promptSnapshot) && (
              <PromptPreviewDialog
                content={job.resolvedPrompt ?? job.promptSnapshot ?? ""}
                label="Prompt"
              />
            )}
            {canDelete && (
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
        </div>

        {/* Inline metadata strip — replaces the metadata cards + Details card */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <Stat icon={Cpu} value={modelLabel} />
          <Stat icon={Clock} value={durationStr ?? "—"} />
          <Stat icon={DollarSign} value={costStr ?? "—"} />
          <Stat
            icon={BarChart3}
            value={`${stockCount} ${stockCount === 1 ? "stock" : "stocks"}`}
          />
          {toolUsageStr && <Stat icon={Search} value={toolUsageStr} />}
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-4 px-4 pb-4 md:px-6">
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

        {/* Research result content (raw and/or formatted) */}
        <ResearchOutputSection job={job} />
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
 * Compact inline metadata item used in the header strip: a small icon followed by
 * its value. Keeps the key job facts on a single dense row instead of bulky cards.
 */
function Stat({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}
