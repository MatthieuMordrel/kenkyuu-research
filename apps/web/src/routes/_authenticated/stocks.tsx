import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStocks, useTags, useDeleteStock } from "@/hooks/use-stocks";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { StockModal } from "@/components/stock-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  TrendingUp,
  ArrowUpDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc } from "@repo/convex/dataModel";

export const Route = createFileRoute("/_authenticated/stocks")({
  component: StocksPage,
});

type SortField = "ticker" | "companyName" | "createdAt" | "updatedAt";

function StocksPage() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Doc<"stocks"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"stocks"> | null>(null);

  const stocks = useStocks({ search, tag: selectedTag, sortBy, sortOrder });
  const tags = useTags();
  const deleteStock = useDeleteStock();

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
    <div className="flex flex-col gap-4">
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

        {/* Tag filter chips */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTag(undefined)}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                !selectedTag
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setSelectedTag(selectedTag === tag ? undefined : tag)
                }
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                  selectedTag === tag
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Sort buttons */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-muted-foreground shrink-0">
            Sort by:
          </span>
          {(
            [
              { field: "ticker", label: "Ticker" },
              { field: "companyName", label: "Name" },
              { field: "createdAt", label: "Date Added" },
              { field: "updatedAt", label: "Updated" },
            ] as const
          ).map(({ field, label }) => (
            <button
              key={field}
              type="button"
              onClick={() => handleSort(field)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                sortBy === field
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
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
          <EmptyState
            icon={TrendingUp}
            title={search || selectedTag ? "No stocks found" : "No stocks yet"}
            description={
              search || selectedTag
                ? "Try adjusting your search or filters."
                : "Add your first stock to get started with research."
            }
            action={
              !search && !selectedTag ? (
                <Button size="sm" onClick={openAdd}>
                  <Plus className="size-4" />
                  Add Stock
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {stocks.map((stock) => (
              <StockCard
                key={stock._id}
                stock={stock}
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

function StockCard({
  stock,
  onEdit,
  onDelete,
}: {
  stock: Doc<"stocks">;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3">
        <Link
          to="/stocks/$stockId"
          params={{ stockId: stock._id }}
          className="flex min-w-0 flex-1 flex-col gap-1"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{stock.ticker}</span>
            <span className="text-xs text-muted-foreground">
              {stock.exchange}
            </span>
          </div>
          <span className="truncate text-sm text-muted-foreground">
            {stock.companyName}
          </span>
          {stock.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {stock.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </Link>
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
