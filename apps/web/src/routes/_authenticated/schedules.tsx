import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useSchedules,
  useUpcomingRuns,
  useToggleSchedule,
  useToggleGlobalPause,
  useDeleteSchedule,
} from "@/hooks/use-schedules";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { ScheduleModal } from "@/components/schedule-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Clock,
  Pause,
  Play,
  Pencil,
  Trash2,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { describeCron } from "@/lib/schedule-validation";
import type { Doc } from "@repo/convex/dataModel";

export const Route = createFileRoute("/_authenticated/schedules")({
  component: SchedulesPage,
});

function SchedulesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Doc<"schedules"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"schedules"> | null>(null);

  const data = useSchedules();
  const upcomingRuns = useUpcomingRuns(5);
  const toggleSchedule = useToggleSchedule();
  const toggleGlobalPause = useToggleGlobalPause();
  const deleteSchedule = useDeleteSchedule();

  function openEdit(schedule: Doc<"schedules">) {
    setEditingSchedule(schedule);
    setModalOpen(true);
  }

  function openAdd() {
    setEditingSchedule(null);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSchedule({ id: deleteTarget._id });
    } finally {
      setDeleteTarget(null);
    }
  }

  const isLoading = data === undefined;
  const schedules = data?.schedules ?? [];
  const globalPaused = data?.globalPaused ?? false;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Schedules"
        description="Manage automated research schedules"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={globalPaused ? "destructive" : "outline"}
              onClick={() => toggleGlobalPause({})}
              disabled={isLoading}
            >
              {globalPaused ? (
                <>
                  <Play className="size-4" />
                  Resume All
                </>
              ) : (
                <>
                  <Pause className="size-4" />
                  Pause All
                </>
              )}
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-4" />
              New Schedule
            </Button>
          </div>
        }
      />

      {/* Global pause banner */}
      {globalPaused && (
        <div className="mx-4 flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive md:mx-6">
          <AlertTriangle className="size-4 shrink-0" />
          <span>All schedules are paused. Click &quot;Resume All&quot; to re-enable.</span>
        </div>
      )}

      {/* Upcoming runs preview */}
      {upcomingRuns && upcomingRuns.length > 0 && !globalPaused && (
        <div className="flex flex-col gap-2 px-4 md:px-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            Upcoming Runs
          </h2>
          <div className="flex flex-col gap-1.5">
            {upcomingRuns.map((run) => (
              <div
                key={`${run.scheduleId}-${run.nextRunAt}`}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
              >
                <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium">{run.scheduleName}</span>
                <span className="text-muted-foreground">—</span>
                <span className="text-muted-foreground">
                  {formatRelativeTime(run.nextRunAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule list */}
      <div className="px-4 pb-4 md:px-6">
        {isLoading ? (
          <ListSkeleton count={3} />
        ) : schedules.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No schedules yet"
            description="Create a schedule to automate your research runs."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="size-4" />
                New Schedule
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {schedules.map((schedule) => (
              <ScheduleCard
                key={schedule._id}
                schedule={schedule}
                globalPaused={globalPaused}
                onToggle={() => toggleSchedule({ id: schedule._id })}
                onEdit={() => openEdit(schedule)}
                onDelete={() => setDeleteTarget(schedule)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <ScheduleModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        schedule={editingSchedule}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              Any pending scheduled runs will be cancelled. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
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

function ScheduleCard({
  schedule,
  globalPaused,
  onToggle,
  onEdit,
  onDelete,
}: {
  schedule: Doc<"schedules">;
  globalPaused: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isActive = schedule.enabled && !globalPaused;

  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3">
        {/* Toggle button */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            isActive ? "bg-primary" : "bg-muted",
            globalPaused && "opacity-50 cursor-not-allowed",
          )}
          disabled={globalPaused}
          aria-label={schedule.enabled ? "Disable schedule" : "Enable schedule"}
        >
          <span
            className={cn(
              "pointer-events-none inline-block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform",
              isActive ? "translate-x-4" : "translate-x-0",
            )}
          />
        </button>

        {/* Schedule info */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">
              {schedule.name}
            </span>
            {!schedule.enabled && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Disabled
              </Badge>
            )}
            {schedule.enabled && globalPaused && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-destructive border-destructive/50">
                Paused
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{describeCron(schedule.cron)}</span>
            <span>{schedule.timezone}</span>
            <StockSelectionLabel selection={schedule.stockSelection} />
          </div>
          {schedule.nextRunAt && isActive && (
            <span className="text-xs text-muted-foreground">
              Next: {formatRelativeTime(schedule.nextRunAt)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.preventDefault();
              onEdit();
            }}
          >
            <Pencil className="size-3.5" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
          >
            <Trash2 className="size-3.5 text-destructive" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StockSelectionLabel({
  selection,
}: {
  selection: Doc<"schedules">["stockSelection"];
}) {
  switch (selection.type) {
    case "all":
      return <span>All stocks</span>;
    case "tagged":
      return <span>Tagged: {selection.tags?.join(", ")}</span>;
    case "specific":
      return (
        <span>
          {selection.stockIds?.length ?? 0} stock
          {(selection.stockIds?.length ?? 0) !== 1 ? "s" : ""}
        </span>
      );
    case "none":
      return <span>Discovery (no stocks)</span>;
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;

  if (diff < 0) {
    return new Date(timestamp).toLocaleString();
  }

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) {
    return `in ${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `in ${hours}h ${minutes % 60}m`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `in ${days}d ${hours % 24}h`;
  }

  return new Date(timestamp).toLocaleDateString();
}
