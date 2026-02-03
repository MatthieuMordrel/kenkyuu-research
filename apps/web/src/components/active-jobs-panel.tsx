import { useState } from "react";
import { useActiveJobs, useCancelJob, useRetryJob } from "@/hooks/use-research";
import { usePrompts } from "@/hooks/use-prompts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Clock,
  Loader2,
  XCircle,
  RotateCcw,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";
import type { Doc } from "@repo/convex/dataModel";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }
> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  running: { label: "Running", variant: "default", icon: Loader2 },
  completed: { label: "Completed", variant: "secondary", icon: Activity },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
};

function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActiveJobsPanel() {
  const activeJobs = useActiveJobs();
  const prompts = usePrompts();

  if (activeJobs === undefined) {
    return (
      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" />
            Active Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const { jobs, count, limit } = activeJobs;

  // Build a map of prompts for quick lookup
  const promptMap = new Map<string, Doc<"prompts">>();
  if (prompts) {
    for (const p of prompts) {
      promptMap.set(p._id, p);
    }
  }

  return (
    <Card className="py-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Activity className="size-4" />
            Active Jobs
          </span>
          <Badge variant="outline" className="text-xs font-normal">
            {count}/{limit} slots
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No active jobs. Start a new research to see it here.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {jobs.map((job) => (
              <JobCard
                key={job._id}
                job={job}
                promptName={promptMap.get(job.promptId)?.name}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobCard({
  job,
  promptName,
}: {
  job: Doc<"researchJobs">;
  promptName?: string;
}) {
  const cancelJob = useCancelJob();
  const retryJob = useRetryJob();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const now = useNow(1_000);

  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const canCancel = job.status === "pending" || job.status === "running";
  const canRetry = job.status === "failed";

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelJob({ id: job._id });
    } finally {
      setCancelling(false);
      setCancelDialogOpen(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryJob({ id: job._id });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            job.status === "running" ? "bg-primary/10" : "bg-muted",
          )}
        >
          <StatusIcon
            className={cn(
              "size-4",
              job.status === "running"
                ? "animate-spin text-primary"
                : "text-muted-foreground",
            )}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {promptName ?? "Research Job"}
            </span>
            <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 shrink-0">
              {config.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{job.stockIds.length} stock{job.stockIds.length !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{formatRelativeTime(job.createdAt, now)}</span>
            {job.attempts > 0 && (
              <>
                <span>·</span>
                <span>Attempt {job.attempts}/3</span>
              </>
            )}
          </div>
          {job.error && (
            <p className="text-xs text-destructive mt-0.5 line-clamp-1">
              {job.error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canRetry && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRetry}
              disabled={retrying}
              title="Retry"
            >
              {retrying ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              <span className="sr-only">Retry</span>
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCancelDialogOpen(true)}
              title="Cancel"
            >
              <XCircle className="size-3.5 text-destructive" />
              <span className="sr-only">Cancel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Research Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this research job? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              Keep Running
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Job"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
