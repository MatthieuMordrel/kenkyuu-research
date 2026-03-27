import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStocks, useTags, useDeleteStock } from "@/hooks/use-stocks";
import { useEarningsSummary } from "@/hooks/use-earnings";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/loading-skeleton";
import { StockModal } from "@/components/stock-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Plus,
  Search,
  TrendingUp,
  ArrowUpDown,
  Pencil,
  Trash2,
  Sparkles,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc } from "@repo/convex/dataModel";

function formatEarningsDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHour(hour?: string): string {
  if (!hour) return "";
  if (hour === "bmo") return "BMO";
  if (hour === "amc") return "AMC";
  return "";
}

export const Route = createFileRoute("/_authenticated/stocks")({
  component: StocksPage,
});

type SortField = "ticker" | "companyName" | "createdAt" | "updatedAt" | "nextEarnings";

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: "ticker", label: "Ticker" },
  { field: "companyName", label: "Name" },
  { field: "createdAt", label: "Date Added" },
  { field: "updatedAt", label: "Updated" },
  { field: "nextEarnings", label: "Next Earnings" },
];

function StocksPage() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Doc<"stocks"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"stocks"> | null>(null);

  const backendSortBy = sortBy === "nextEarnings" ? undefined : sortBy;
  const backendSortOrder = sortBy === "nextEarnings" ? undefined : sortOrder;
  const stocks = useStocks({ search, tag: selectedTag, sortBy: backendSortBy, sortOrder: backendSortOrder });
  const tags = useTags();
  const deleteStock = useDeleteStock();
  const earningsSummary = useEarningsSummary();

  const sortedStocks = useMemo(() => {
    if (!stocks || sortBy !== "nextEarnings" || !earningsSummary) return stocks;
    return [...stocks].sort((a, b) => {
      const aDate = earningsSummary[a._id]?.next?.date ?? "";
      const bDate = earningsSummary[b._id]?.next?.date ?? "";
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      const cmp = aDate.localeCompare(bDate);
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [stocks, sortBy, sortOrder, earningsSummary]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  function openEdit(stock: Doc<"stocks">) {
    setEditingStock(stock);
    setModalOpen(true);
  }

  function openAdd() {
    setEditingStock(null);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteStock({ id: deleteTarget._id });
    } finally {
      setDeleteTarget(null);
    }
  }

  const isLoading = stocks === undefined;

  return (
    <div className="flex flex-col gap-4 overflow-x-hidden">
      <PageHeader
        title="Stocks"
        description="Manage your stock watchlist"
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            Add Stock
          </Button>
        }
      />

      <div className="flex flex-col gap-3 px-4 md:px-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ticker or company name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tag filter pills */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTag(undefined)}
              className={cn(
                "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all",
                !selectedTag
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              All
              {!isLoading && !selectedTag && stocks && (
                <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 text-[10px]">
                  {stocks.length}
                </span>
              )}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setSelectedTag(selectedTag === tag ? undefined : tag)
                }
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all",
                  selectedTag === tag
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Sort pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground shrink-0">Sort:</span>
          {SORT_OPTIONS.map(({ field, label }) => (
            <button
              key={field}
              type="button"
              onClick={() => handleSort(field)}
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                sortBy === field
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
              {sortBy === field && (
                <ArrowUpDown className="size-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stock list */}
      <div className="px-4 pb-4 md:px-6">
        {isLoading ? (
          <ListSkeleton count={5} />
        ) : stocks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              {search || selectedTag ? (
                <Search className="size-5 text-muted-foreground" />
              ) : (
                <Sparkles className="size-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {search || selectedTag ? "No stocks found" : "No stocks yet"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {search || selectedTag
                  ? "Try adjusting your search or filters."
                  : "Add your first stock to get started with research."}
              </p>
            </div>
            {!search && !selectedTag && (
              <Button size="sm" variant="outline" onClick={openAdd} className="mt-1">
                <Plus className="size-4" />
                Add Stock
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(sortedStocks ?? []).map((stock) => (
              <StockRow
                key={stock._id}
                stock={stock}
                earnings={earningsSummary?.[stock._id]}
                onEdit={() => openEdit(stock)}
                onDelete={() => setDeleteTarget(stock)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <StockModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        stock={editingStock}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Stock</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteTarget?.ticker} (
              {deleteTarget?.companyName})? This action cannot be undone.
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

interface EarningsSummary {
  previous?: { date: string; hour?: string };
  next?: { date: string; hour?: string };
  nextNext?: { date: string; hour?: string };
}

function StockRow({
  stock,
  earnings,
  onEdit,
  onDelete,
}: {
  stock: Doc<"stocks">;
  earnings?: EarningsSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Link
      to="/stocks/$stockId"
      params={{ stockId: stock._id }}
      className="group flex h-16 items-center gap-3 rounded-xl px-3 transition-all hover:bg-accent"
    >
      {/* Ticker badge */}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
        <TrendingUp className="size-4" />
      </div>

      {/* Content — two rows */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{stock.ticker}</span>
          <Badge
            variant="outline"
            className="shrink-0 whitespace-nowrap rounded-md px-1.5 py-0 text-[10px] font-semibold tracking-wide"
          >
            {stock.exchange}
          </Badge>
          {stock.tags.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {stock.tags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="whitespace-nowrap rounded-md px-1.5 py-0 text-[10px] font-semibold tracking-wide"
                >
                  {tag}
                </Badge>
              ))}
              {stock.tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">
                  +{stock.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {stock.companyName}
          </span>
          {earnings?.next && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Calendar className="size-3" />
              {formatEarningsDate(earnings.next.date)}
              {formatHour(earnings.next.hour) && (
                <span className="text-emerald-500/70 dark:text-emerald-400/70">
                  {formatHour(earnings.next.hour)}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Earnings — visible on wider screens */}
      {earnings && (earnings.previous || earnings.next) && (
        <div className="hidden md:flex shrink-0 flex-col items-end gap-0.5 text-xs">
          {earnings.previous && (
            <span className="text-muted-foreground">
              <span className="text-muted-foreground/60">Prev</span>{" "}
              {formatEarningsDate(earnings.previous.date)}
            </span>
          )}
          {earnings.next && (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              Next {formatEarningsDate(earnings.next.date)}
              {formatHour(earnings.next.hour) && (
                <span className="ml-0.5 text-[11px] font-normal text-emerald-500/70 dark:text-emerald-400/70">
                  {formatHour(earnings.next.hour)}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Actions — visible on hover */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.preventDefault();
            onEdit();
          }}
          title="Edit stock"
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
          title="Delete stock"
        >
          <Trash2 className="size-3.5 text-destructive" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    </Link>
  );
}
