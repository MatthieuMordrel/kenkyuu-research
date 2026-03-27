import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStock, useDeleteStock } from "@/hooks/use-stocks";
import { useStockEarnings } from "@/hooks/use-earnings";
import { PageHeader } from "@/components/page-header";
import { StockModal } from "@/components/stock-modal";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";
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
  ArrowLeft,
  Pencil,
  Trash2,
  TrendingUp,
  Building2,
  Tag,
  Calendar,
  FileText,
  FlaskConical,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenericId } from "convex/values";

export const Route = createFileRoute("/_authenticated/stocks/$stockId")({
  component: StockDetailPage,
});

function StockDetailPage() {
  const { stockId } = Route.useParams();
  const stock = useStock(stockId as GenericId<"stocks">);
  const earnings = useStockEarnings(stockId as GenericId<"stocks">);
  const navigate = useNavigate();
  const deleteStock = useDeleteStock();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    if (!stock) return;
    try {
      await deleteStock({ id: stock._id });
      navigate({ to: "/stocks" });
    } catch {
      setDeleteOpen(false);
    }
  }

  if (stock === undefined) {
    return <PageSkeleton />;
  }

  if (stock === null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="px-4 pt-4 md:px-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/stocks">
              <ArrowLeft className="size-4" />
              Back to Stocks
            </Link>
          </Button>
        </div>
        <EmptyState
          icon={TrendingUp}
          title="Stock not found"
          description="This stock may have been deleted."
          action={
            <Button size="sm" asChild>
              <Link to="/stocks">Back to Stocks</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const addedDate = new Date(stock.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const updatedDate = new Date(stock.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 overflow-x-hidden">
      <div className="px-4 pt-4 md:px-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/stocks">
            <ArrowLeft className="size-4" />
            Back to Stocks
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${stock.ticker} — ${stock.companyName}`}
        description={`${stock.exchange}${stock.sector ? ` · ${stock.sector}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4 text-destructive" />
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 px-4 pb-4 md:grid-cols-2 md:px-6">
        {/* Stock Info */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Building2 className="size-4" />
            </div>
            <h3 className="text-sm font-semibold">Stock Details</h3>
          </div>
          <dl className="flex flex-col gap-3 text-sm">
            <DetailRow label="Ticker" value={stock.ticker} />
            <DetailRow label="Exchange" value={stock.exchange} />
            <DetailRow label="Sector" value={stock.sector || "—"} />
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3" />
                Added
              </dt>
              <dd className="text-right">{addedDate}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3" />
                Updated
              </dt>
              <dd className="text-right">{updatedDate}</dd>
            </div>
          </dl>
        </div>

        {/* Tags */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
              <Tag className="size-4" />
            </div>
            <h3 className="text-sm font-semibold">Tags</h3>
          </div>
          {stock.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {stock.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tags added yet.</p>
          )}
        </div>

        {/* Notes */}
        {stock.notes && (
          <div className="rounded-xl border bg-card p-5 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <FileText className="size-4" />
              </div>
              <h3 className="text-sm font-semibold">Notes</h3>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{stock.notes}</p>
          </div>
        )}

        {/* Earnings */}
        <EarningsSection earnings={earnings} />

        {/* Research History */}
        <div className="rounded-xl border bg-card p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <FlaskConical className="size-4" />
            </div>
            <h3 className="text-sm font-semibold">Research History</h3>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <FlaskConical className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No research yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Research results for this stock will appear here.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <StockModal
        open={editOpen}
        onOpenChange={setEditOpen}
        stock={stock}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Stock</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {stock.ticker} ({stock.companyName}
              )? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function formatEarningsDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHour(hour?: string): string {
  if (hour === "bmo") return "Before Market Open";
  if (hour === "amc") return "After Market Close";
  return "";
}

interface EarningsEntry {
  date: string;
  epsEstimate?: number;
  epsActual?: number;
  revenueEstimate?: number;
  revenueActual?: number;
  hour?: string;
  quarter?: number;
  year?: number;
}

function EarningsSection({ earnings }: { earnings?: EarningsEntry[] }) {
  if (!earnings) return null;

  const today = new Date().toISOString().split("T")[0]!;
  const past = earnings.filter((e) => e.date < today);
  const future = earnings.filter((e) => e.date >= today);

  const previous = past.length > 0 ? past[past.length - 1] : undefined;
  const next = future.length > 0 ? future[0] : undefined;
  const nextNext = future.length > 1 ? future[1] : undefined;

  const keyDates = [
    { label: "Previous", entry: previous, style: "text-muted-foreground" },
    { label: "Next", entry: next, style: "font-medium text-emerald-600 dark:text-emerald-400" },
    { label: "Following", entry: nextNext, style: "text-muted-foreground" },
  ].filter((d) => d.entry);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
          <BarChart3 className="size-4" />
        </div>
        <h3 className="text-sm font-semibold">Earnings</h3>
      </div>
      {keyDates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No earnings data available.</p>
      ) : (
        <dl className="flex flex-col gap-3 text-sm">
          {keyDates.map(({ label, entry, style }) => (
            <div key={label} className="flex justify-between">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right">
                <span className={cn(style)}>
                  {formatEarningsDate(entry!.date)}
                </span>
                {formatHour(entry!.hour) && (
                  <span className="text-muted-foreground text-xs ml-1">
                    ({formatHour(entry!.hour)})
                  </span>
                )}
                {entry!.quarter && entry!.year && (
                  <span className="text-muted-foreground text-xs ml-1">
                    Q{entry!.quarter} {entry!.year}
                  </span>
                )}
              </dd>
            </div>
          ))}
          {previous?.epsActual != null && (
            <div className="flex justify-between border-t pt-3">
              <dt className="text-muted-foreground">Last EPS</dt>
              <dd>
                <span className="font-medium">${previous.epsActual.toFixed(2)}</span>
                {previous.epsEstimate != null && (
                  <span className="text-muted-foreground text-xs ml-1">
                    (est. ${previous.epsEstimate.toFixed(2)})
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
