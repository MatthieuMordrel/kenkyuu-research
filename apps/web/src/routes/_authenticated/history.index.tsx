import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useResearchHistory,
  useSearchResults,
  useToggleFavorite,
} from "@/hooks/use-research-history";
import { useStocks } from "@/hooks/use-stocks";
import { usePrompts } from "@/hooks/use-prompts";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  History,
  Star,
  Filter,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenericId } from "convex/values";
import type { Doc } from "@repo/convex/dataModel";

export const Route = createFileRoute("/_authenticated/history/")({
  component: HistoryPage,
});

type JobStatus = "pending" | "running" | "completed" | "failed";

const STATUS_OPTIONS: { value: JobStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "pending", label: "Pending" },
];

function HistoryPage() {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JobStatus | undefined>();
  const [stockFilter, setStockFilter] = useState<
    GenericId<"stocks"> | undefined
  >();
  const [promptFilter, setPromptFilter] = useState<
    GenericId<"prompts"> | undefined
  >();
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const dateFromMs = dateFrom
    ? new Date(dateFrom).getTime()
    : undefined;
  const dateToMs = dateTo
    ? new Date(dateTo + "T23:59:59").getTime()
    : undefined;

  const {
    results,
    isLoading,
    isDone,
    loadMore,
  } = useResearchHistory({
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
        title="Research History"
        description="Browse and search past research results"
      />

      <div className="flex flex-col gap-3 px-4 md:px-6">
        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search within results..."
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

            {/* Status filter */}
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

            {/* Stock filter */}
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

            {/* Prompt filter */}
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
      </div>

      {/* Results list */}
      <div className="px-4 pb-4 md:px-6">
        {isDisplayLoading ? (
          <ListSkeleton count={5} />
        ) : !displayResults || displayResults.length === 0 ? (
          <EmptyState
            icon={History}
            title={
              isSearchMode || hasActiveFilters
                ? "No results found"
                : "No research history"
            }
            description={
              isSearchMode || hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Research results will appear here once you run a job."
            }
            action={
              hasActiveFilters ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {displayResults.map((job) => (
              <ResultCard
                key={job._id}
                job={job}
                onToggleFavorite={() =>
                  toggleFavorite({ id: job._id })
                }
              />
            ))}

            {/* Load more (only in non-search mode) */}
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
    </div>
  );
}

const statusConfig: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  completed: { variant: "secondary", label: "Completed" },
  failed: { variant: "destructive", label: "Failed" },
  running: { variant: "outline", label: "Running" },
  pending: { variant: "outline", label: "Pending" },
};

function ResultCard({
  job,
  onToggleFavorite,
}: {
  job: Doc<"researchJobs">;
  onToggleFavorite: () => void;
}) {
  const config = statusConfig[job.status] ?? statusConfig.pending;
  const createdDate = new Date(job.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const createdTime = new Date(job.createdAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const durationStr = job.durationMs
    ? `${Math.round(job.durationMs / 1000)}s`
    : undefined;

  const costStr = job.costUsd
    ? `$${job.costUsd.toFixed(2)}`
    : undefined;

  const snippet =
    job.result
      ? job.result.replace(/[#*_`>[\]]/g, "").slice(0, 120) + (job.result.length > 120 ? "..." : "")
      : job.error
        ? job.error.slice(0, 100)
        : undefined;

  return (
    <Card className="py-3 transition-colors hover:bg-accent/30">
      <CardContent className="flex items-start gap-3">
        <Link
          to="/history/$jobId"
          params={{ jobId: job._id }}
          className="flex min-w-0 flex-1 flex-col gap-1"
        >
          <div className="flex items-center gap-2">
            <Badge
              variant={config.variant}
              className="text-[10px] px-1.5 py-0"
            >
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {createdDate} {createdTime}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {job.stockIds.length} stock{job.stockIds.length !== 1 ? "s" : ""}
            </span>
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
          </div>

          {snippet && (
            <p className="mt-0.5 text-xs text-muted-foreground/80 line-clamp-2">
              {snippet}
            </p>
          )}
        </Link>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onToggleFavorite();
          }}
          className="shrink-0 p-1 rounded-md hover:bg-accent transition-colors"
          aria-label={job.isFavorited ? "Remove from favorites" : "Add to favorites"}
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
      </CardContent>
    </Card>
  );
}
