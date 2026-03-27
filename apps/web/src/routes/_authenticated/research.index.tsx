import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useResearchFlow } from "@/hooks/use-research-flow";
import { useDeleteJob } from "@/hooks/use-research";
import {
  useResearchHistory,
  useSearchResults,
  useToggleFavorite,
} from "@/hooks/use-research-history";
import { useStocks } from "@/hooks/use-stocks";
import { usePrompts } from "@/hooks/use-prompts";
import { ResearchWizard } from "@/components/research-wizard";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FlaskConical,
  Plus,
  Search,
  Star,
  Filter,
  X,
  ChevronDown,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenericId } from "convex/values";
import type { Doc } from "@repo/convex/dataModel";

export const Route = createFileRoute("/_authenticated/research/")({
  component: ResearchPage,
});

type JobStatus = "pending" | "running" | "completed" | "failed";

const STATUS_OPTIONS: { value: JobStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "running", label: "Running" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

function ResearchPage() {
  const flow = useResearchFlow();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JobStatus | undefined>();
  const [stockFilter, setStockFilter] = useState<
    GenericId<"stocks"> | undefined
  >();
  const [promptFilter, setPromptFilter] = useState<
    GenericId<"prompts"> | undefined
  >();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const dateFromMs = dateFrom ? new Date(dateFrom).getTime() : undefined;
  const dateToMs = dateTo
    ? new Date(dateTo + "T23:59:59").getTime()
    : undefined;

  const { results, isLoading, isDone, loadMore } = useResearchHistory({
    status: statusFilter,
    stockId: stockFilter,
    promptId: promptFilter,
    dateFrom: dateFromMs,
    dateTo: dateToMs,
  });

  const searchResults = useSearchResults(search);
  const stocks = useStocks();
  const prompts = usePrompts();
  const toggleFavorite = useToggleFavorite();
  const deleteJob = useDeleteJob();
  const [deleteTarget, setDeleteTarget] = useState<Doc<"researchJobs"> | null>(
    null,
  );

  // Build stock lookup map
  const stockMap = new Map<string, Doc<"stocks">>();
  if (stocks) {
    for (const s of stocks) {
      stockMap.set(s._id, s);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteJob({ id: deleteTarget._id });
    } finally {
      setDeleteTarget(null);
    }
  }

  const isSearchMode = search.length > 0;
  const displayResults = isSearchMode ? searchResults : results;
  const isDisplayLoading = isSearchMode
    ? searchResults === undefined
    : isLoading;

  const hasActiveFilters =
    statusFilter !== undefined ||
    stockFilter !== undefined ||
    promptFilter !== undefined ||
    dateFrom !== "" ||
    dateTo !== "";

  function clearFilters() {
    setStatusFilter(undefined);
    setStockFilter(undefined);
    setPromptFilter(undefined);
    setDateFrom("");
    setDateTo("");
  }

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

      <div className="flex flex-col gap-3 px-4 md:px-6 pb-4">
        {/* Search & filter bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search research..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0"
          >
            <Filter className="size-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                !
              </span>
            )}
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filters</span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                  Clear all
                </button>
              )}
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setStatusFilter(opt.value)}
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                      statusFilter === opt.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Stock</label>
              <div className="relative">
                <select
                  value={stockFilter ?? ""}
                  onChange={(e) =>
                    setStockFilter(
                      e.target.value
                        ? (e.target.value as GenericId<"stocks">)
                        : undefined,
                    )
                  }
                  className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 pr-8 text-sm"
                >
                  <option value="">All stocks</option>
                  {stocks?.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.ticker} — {s.companyName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Prompt */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                Prompt Template
              </label>
              <div className="relative">
                <select
                  value={promptFilter ?? ""}
                  onChange={(e) =>
                    setPromptFilter(
                      e.target.value
                        ? (e.target.value as GenericId<"prompts">)
                        : undefined,
                    )
                  }
                  className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 pr-8 text-sm"
                >
                  <option value="">All prompts</option>
                  {prompts?.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {isDisplayLoading ? (
          <ListSkeleton count={5} />
        ) : !displayResults || displayResults.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title={
              isSearchMode || hasActiveFilters
                ? "No results found"
                : "No research yet"
            }
            description={
              isSearchMode || hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Start your first research to see results here."
            }
            action={
              hasActiveFilters ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={flow.open}>
                  <Plus className="size-4" />
                  New Research
                </Button>
              )
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {displayResults.map((job) => (
              <ResultCard
                key={job._id}
                job={job}
                stockMap={stockMap}
                onToggleFavorite={() => toggleFavorite({ id: job._id })}
                onDelete={() => setDeleteTarget(job)}
              />
            ))}

            {!isSearchMode && !isDone && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" onClick={loadMore}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResearchWizard />
    </div>
  );
}

/* ─── Status config ──────────────────────────────────────────── */

const statusConfig: Record<
  string,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    label: string;
    dotClass: string;
  }
> = {
  completed: { variant: "secondary", label: "Completed", dotClass: "bg-green-500" },
  failed: { variant: "destructive", label: "Failed", dotClass: "bg-red-500" },
  running: { variant: "outline", label: "Running", dotClass: "bg-blue-500 animate-pulse" },
  pending: { variant: "outline", label: "Pending", dotClass: "bg-yellow-500 animate-pulse" },
};

/* ─── Result Card ────────────────────────────────────────────── */

function ResultCard({
  job,
  stockMap,
  onToggleFavorite,
  onDelete,
}: {
  job: Doc<"researchJobs">;
  stockMap: Map<string, Doc<"stocks">>;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const config = statusConfig[job.status] ?? statusConfig.pending;
  const isActive = job.status === "running" || job.status === "pending";

  const createdDate = new Date(job.createdAt).toLocaleDateString("en-US", {
    month: "short",
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

  const costStr = job.costUsd ? `$${job.costUsd.toFixed(2)}` : undefined;

  // Resolve stock tickers
  const stockTickers = job.stockIds
    .map((id) => stockMap.get(id as string))
    .filter(Boolean)
    .map((s) => s!.ticker);

  const snippet = job.result
    ? job.result.replace(/[#*_`>[\]]/g, "").slice(0, 140) +
      (job.result.length > 140 ? "..." : "")
    : job.error
      ? job.error.slice(0, 100)
      : undefined;

  return (
    <Card
      className={cn(
        "h-[88px] py-3 transition-colors hover:bg-accent/30",
        isActive && "border-primary/30 bg-primary/[0.02]",
      )}
    >
      <CardContent className="flex h-full items-center gap-3">
        <Link
          to="/research/$jobId"
          params={{ jobId: job._id }}
          className="flex min-w-0 flex-1 flex-col justify-center gap-1.5"
        >
          {/* Row 1: Stocks + status */}
          <div className="flex items-center gap-2">
            {stockTickers.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {stockTickers.map((ticker) => (
                  <span
                    key={ticker}
                    className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold"
                  >
                    {ticker}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm font-medium">
                {job.stockIds.length} stock{job.stockIds.length !== 1 ? "s" : ""}
              </span>
            )}
            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <span className={cn("size-1.5 rounded-full", config.dotClass)} />
              <span className="text-[11px] text-muted-foreground">
                {config.label}
              </span>
              {isActive && (
                <Loader2 className="size-3 animate-spin text-primary" />
              )}
            </div>
          </div>

          {/* Row 2: Meta info + snippet */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{createdDate} {createdTime}</span>
            {durationStr && (
              <>
                <span>·</span>
                <span>{durationStr}</span>
              </>
            )}
            {costStr && (
              <>
                <span>·</span>
                <span>{costStr}</span>
              </>
            )}
            {snippet && (
              <>
                <span>·</span>
                <span className="truncate text-muted-foreground/70">{snippet}</span>
              </>
            )}
          </div>
        </Link>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite();
            }}
            className="p-1 rounded-md hover:bg-accent transition-colors"
            aria-label={
              job.isFavorited ? "Remove from favorites" : "Add to favorites"
            }
          >
            <Star
              className={cn(
                "size-4",
                job.isFavorited
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground",
              )}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className={cn(
              "p-1 rounded-md hover:bg-destructive/10 transition-colors",
              isActive && "invisible",
            )}
            aria-label="Delete research job"
            tabIndex={isActive ? -1 : undefined}
          >
            <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
