import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  useStock,
  useUpdateStock,
  useDeleteStock,
  useTags,
} from "@/hooks/use-stocks";
import { useStockEarnings } from "@/hooks/use-earnings";
import { StockModal } from "@/components/stock-modal";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Plus,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GenericId } from "convex/values";
import type { Doc } from "@repo/convex/dataModel";

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
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!stock) return;
    setDeleting(true);
    try {
      await deleteStock({ id: stock._id });
      navigate({ to: "/stocks" });
    } catch {
      setDeleting(false);
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
          <Button variant="ghost" size="sm" render={<Link to="/stocks" />}>
            <ArrowLeft className="size-4" />
            Back to Stocks
          </Button>
        </div>
        <EmptyState
          icon={TrendingUp}
          title="Stock not found"
          description="This stock may have been deleted."
          action={
            <Button size="sm" render={<Link to="/stocks" />}>
              Back to Stocks
            </Button>
          }
        />
      </div>
    );
  }

  const addedDate = new Date(stock.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const updatedDate = new Date(stock.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Back nav */}
      <div className="px-4 pt-4 md:px-6">
        <Button variant="ghost" size="sm" render={<Link to="/stocks" />}>
          <ArrowLeft className="size-4" />
          Back to Stocks
        </Button>
      </div>

      {/* Hero Header */}
      <div className="px-4 md:px-6">
        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {stock.ticker}
                </h1>
                <Badge variant="outline" className="text-xs font-medium">
                  {stock.exchange}
                </Badge>
                {stock.sector && (
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium hidden sm:inline-flex"
                  >
                    {stock.sector}
                  </Badge>
                )}
              </div>
              <p className="text-base text-muted-foreground sm:text-lg">
                {stock.companyName}
              </p>
              {stock.sector && (
                <p className="text-sm text-muted-foreground sm:hidden">
                  {stock.sector}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  Added {addedDate}
                </span>
                <span className="hidden sm:inline">·</span>
                <span>Updated {updatedDate}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-4 px-4 md:px-6">
        {/* Tags — Inline Editable */}
        <TagsManager stock={stock} />

        {/* Notes — Inline Editable */}
        <NotesEditor stock={stock} />

        {/* Details + Earnings Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-xl border bg-card p-5 text-left cursor-pointer hover:border-foreground/20 transition-colors"
          >
            <SectionHeader icon={Building2} title="Details" color="blue" />
            <dl className="flex flex-col gap-3 text-sm">
              <DetailRow label="Ticker" value={stock.ticker} />
              <DetailRow label="Exchange" value={stock.exchange} />
              <DetailRow label="Sector" value={stock.sector || "—"} />
              <DetailRow label="Added" value={addedDate} />
              <DetailRow label="Updated" value={updatedDate} />
            </dl>
          </button>

          <EarningsSection earnings={earnings} />
        </div>

        {/* Research History */}
        <div className="rounded-xl border bg-card p-5">
          <SectionHeader
            icon={FlaskConical}
            title="Research History"
            color="indigo"
          />
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
      <StockModal open={editOpen} onOpenChange={setEditOpen} stock={stock} />

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Delete Stock
            </DialogTitle>
            <DialogDescription className="pt-1">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {stock.ticker}
              </span>{" "}
              ({stock.companyName})? This will permanently remove the stock and
              all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Shared sub-components ---

const COLOR_MAP = {
  blue: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  violet:
    "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
  amber:
    "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  emerald:
    "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  indigo:
    "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
} as const;

function SectionHeader({
  icon: Icon,
  title,
  color,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  color: keyof typeof COLOR_MAP;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            COLOR_MAP[color]
          )}
        >
          <Icon className="size-4" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {action}
    </div>
  );
}

// --- Tags: Inline add/remove ---

function TagsManager({ stock }: { stock: Doc<"stocks"> }) {
  const updateStock = useUpdateStock();
  const existingTags = useTags();
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addTag(tagValue?: string) {
    const tag = (tagValue ?? tagInput).trim().toLowerCase();
    if (!tag || stock.tags.includes(tag)) {
      setTagInput("");
      return;
    }

    setSaving(true);
    setError(null);
    setTagInput("");
    try {
      await updateStock({
        id: stock._id,
        tags: [...stock.tags, tag],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag");
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tagToRemove: string) {
    setSaving(true);
    setError(null);
    try {
      await updateStock({
        id: stock._id,
        tags: stock.tags.filter((t) => t !== tagToRemove),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove tag");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  }

  const suggestedTags =
    existingTags?.filter((t) => !stock.tags.includes(t)) ?? [];

  return (
    <div className="rounded-xl border bg-card p-5">
      <SectionHeader icon={Tag} title="Tags" color="violet" />

      {/* Current tags */}
      {stock.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {stock.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1 rounded-md text-xs font-semibold tracking-wide"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={saving}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-foreground/20 transition-colors disabled:opacity-50"
              >
                <X className="size-3" />
                <span className="sr-only">Remove {tag}</span>
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-4">
          No tags yet. Add tags to organize this stock.
        </p>
      )}

      {/* Add tag input */}
      <div className="flex gap-2">
        <Input
          placeholder="Type a tag and press Enter"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addTag()}
          disabled={saving || !tagInput.trim()}
          className="shrink-0"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {/* Suggested existing tags */}
      {suggestedTags.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Quick add:</span>
          <div className="flex flex-wrap gap-1.5">
            {suggestedTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="cursor-pointer text-xs hover:bg-accent transition-colors"
                onClick={() => addTag(tag)}
              >
                <Plus className="size-3 mr-0.5" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

// --- Notes: Inline view/edit toggle ---

function NotesEditor({ stock }: { stock: Doc<"stocks"> }) {
  const updateStock = useUpdateStock();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setValue(stock.notes || "");
    setEditing(true);
    setError(null);
  }

  async function saveNotes() {
    setSaving(true);
    setError(null);
    try {
      await updateStock({
        id: stock._id,
        notes: value.trim() || undefined,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    setEditing(false);
    setError(null);
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <SectionHeader
        icon={FileText}
        title="Notes"
        color="amber"
        action={
          !editing ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={startEditing}
              className="h-7 text-xs"
            >
              <Pencil className="size-3" />
              {stock.notes ? "Edit" : "Add"}
            </Button>
          ) : undefined
        }
      />

      {editing ? (
        <div className="flex flex-col gap-3">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add notes about this stock..."
            rows={5}
            className="text-sm"
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelEditing}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={saveNotes} disabled={saving}>
              {saving ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="w-full text-left cursor-pointer rounded-lg p-2 -m-2 hover:bg-muted/50 transition-colors"
        >
          {stock.notes ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80">
              {stock.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No notes yet. Tap to add notes.
            </p>
          )}
        </button>
      )}
    </div>
  );
}

// --- Detail row ---

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

// --- Earnings ---

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
    {
      label: "Next",
      entry: next,
      style: "font-medium text-emerald-600 dark:text-emerald-400",
    },
    { label: "Following", entry: nextNext, style: "text-muted-foreground" },
  ].filter((d) => d.entry);

  return (
    <div className="rounded-xl border bg-card p-5">
      <SectionHeader icon={BarChart3} title="Earnings" color="emerald" />
      {keyDates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No earnings data available.
        </p>
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
                <span className="font-medium">
                  ${previous.epsActual.toFixed(2)}
                </span>
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
