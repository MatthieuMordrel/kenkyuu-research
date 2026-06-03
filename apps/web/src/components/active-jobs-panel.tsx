import { useState } from "react";
import {
  useActiveJobs,
  useCancelJob,
  useRetryJob,
  useCheckJobHealth,
} from "@/hooks/use-research";
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
  HeartPulse,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";
import type { Doc } from "@repo/convex/dataModel";

interface HealthCheckResult {
  convexStatus: string;
  providerStatus: string | null;
  provider: "openai" | "anthropic";
  message: string;
  elapsedMs?: number;
  checkedAt: number;
}

const PROVIDER_LABEL: Record<HealthCheckResult["provider"], string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof Clock;
  }
> = {
  pending: { label: "Queued", variant: "outline", icon: Clock },
  running: { label: "Running", variant: "default", icon: Loader2 },
  formatting: { label: "Formatting", variant: "outline", icon: Loader2 },
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

  const { jobs, count, byProvider } = activeJobs;

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
            {count} active · OpenAI {byProvider.openai.active}/
            {byProvider.openai.limit}, Anthropic {byProvider.anthropic.active}/
            {byProvider.anthropic.limit}
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

function HealthStatusIndicator({ result }: { result: HealthCheckResult }) {
  const isHealthy =
    result.providerStatus === "running" ||
    result.providerStatus === "in_progress" ||
    result.providerStatus === "queued";
  const isCompleted = result.providerStatus === "completed";

  const Icon = isCompleted
    ? CheckCircle2
    : isHealthy
      ? CheckCircle2
      : AlertCircle;
  const colorClass = isCompleted
    ? "text-blue-500"
    : isHealthy
      ? "text-green-500"
      : "text-yellow-500";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1" />
        }
      >
        <Icon className={cn("size-3", colorClass)} />
        <span className="text-[10px] font-medium">
          {PROVIDER_LABEL[result.provider]}:{" "}
          {result.providerStatus ?? "unknown"}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-xs">{result.message}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Checked {formatRelativeTime(result.checkedAt, Date.now())}
        </p>
      </TooltipContent>
    </Tooltip>
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
  const checkHealth = useCheckJobHealth();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(
    null
  );
  const now = useNow(1_000);

  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const isInProgress =
    job.status === "running" || job.status === "formatting";
  const canCancel =
    job.status === "pending" ||
    job.status === "running" ||
    job.status === "formatting";
  const canRetry = job.status === "failed";
  const canCheck = job.status === "running" || job.status === "pending";

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

  async function handleCheckHealth() {
    setChecking(true);
    try {
      const result = await checkHealth({ jobId: job._id });
      setHealthResult(result as HealthCheckResult);
    } catch {
      setHealthResult({
        convexStatus: job.status,
        providerStatus: null,
        provider: job.provider,
        message: "Failed to check health.",
        checkedAt: Date.now(),
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md",
              isInProgress ? "bg-primary/10" : "bg-muted",
              job.status === "formatting" && "bg-violet-500/10"
            )}
          >
            <StatusIcon
              className={cn(
                "size-4",
                isInProgress
                  ? cn(
                      "animate-spin",
                      job.status === "formatting"
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-primary"
                    )
                  : "text-muted-foreground"
              )}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">
                {promptName ?? "Research Job"}
              </span>
              <Badge
                variant={config.variant}
                className="text-[10px] px-1.5 py-0 shrink-0"
              >
                {config.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {job.stockIds.length} stock
                {job.stockIds.length !== 1 ? "s" : ""}
              </span>
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
            {canCheck && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleCheckHealth}
                      disabled={checking}
                    />
                  }
                >
                  {checking ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <HeartPulse className="size-3.5" />
                  )}
                  <span className="sr-only">Check Health</span>
                </TooltipTrigger>
                <TooltipContent>Check provider status</TooltipContent>
              </Tooltip>
            )}
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

        {/* Health check result */}
        {healthResult && <HealthStatusIndicator result={healthResult} />}
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
