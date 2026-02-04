import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAddStock, useUpdateStock, useTags } from "@/hooks/use-stocks";
import {
  validateStockForm,
  hasErrors,
  normalizeTicker,
  type StockFormData,
  type StockFormErrors,
} from "@/lib/stock-validation";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Doc } from "@repo/convex/dataModel";

const EXCHANGES = [
  "NASDAQ",
  "NYSE",
  "LSE",
  "TSE",
  "HKEX",
  "Euronext",
  "SSE",
  "SZSE",
  "TSX",
  "ASX",
] as const;

interface StockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stock?: Doc<"stocks"> | null;
}

const INITIAL_FORM: StockFormData = {
  ticker: "",
  companyName: "",
  exchange: "",
  sector: "",
  notes: "",
  tags: [],
};

export function StockModal({ open, onOpenChange, stock }: StockModalProps) {
  const addStock = useAddStock();
  const updateStock = useUpdateStock();
  const existingTags = useTags();
  const isEditing = !!stock;

  const [form, setForm] = useState<StockFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<StockFormErrors>({});
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (stock) {
        setForm({
          ticker: stock.ticker,
          companyName: stock.companyName,
          exchange: stock.exchange,
          sector: stock.sector ?? "",
          notes: stock.notes ?? "",
          tags: [...stock.tags],
        });
      } else {
        setForm(INITIAL_FORM);
      }
      setErrors({});
      setTagInput("");
      setSubmitError(null);
    }
  }, [open, stock]);

  function updateField(field: keyof StockFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof StockFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const normalizedForm = {
      ...form,
      ticker: normalizeTicker(form.ticker),
    };

    const validationErrors = validateStockForm(normalizedForm);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSubmitting(true);
    try {
      if (isEditing && stock) {
        await updateStock({
          id: stock._id,
          ticker: normalizedForm.ticker,
          companyName: normalizedForm.companyName.trim(),
          exchange: normalizedForm.exchange.trim(),
          sector: normalizedForm.sector?.trim() || undefined,
          notes: normalizedForm.notes?.trim() || undefined,
          tags: normalizedForm.tags,
        });
      } else {
        await addStock({
          ticker: normalizedForm.ticker,
          companyName: normalizedForm.companyName.trim(),
          exchange: normalizedForm.exchange.trim(),
          sector: normalizedForm.sector?.trim() || undefined,
          notes: normalizedForm.notes?.trim() || undefined,
          tags: normalizedForm.tags,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An error occurred",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Stock" : "Add Stock"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the stock details below."
              : "Add a new stock to your watchlist."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticker">Ticker *</Label>
            <Input
              id="ticker"
              placeholder="e.g. AAPL"
              value={form.ticker}
              onChange={(e) => updateField("ticker", e.target.value)}
              aria-invalid={!!errors.ticker}
              autoCapitalize="characters"
            />
            {errors.ticker && (
              <p className="text-xs text-destructive">{errors.ticker}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              placeholder="e.g. Apple Inc."
              value={form.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
              aria-invalid={!!errors.companyName}
            />
            {errors.companyName && (
              <p className="text-xs text-destructive">{errors.companyName}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="exchange">Exchange *</Label>
            <Select
              value={form.exchange || null}
              onValueChange={(value) => updateField("exchange", value)}
            >
              <SelectTrigger
                id="exchange"
                aria-invalid={!!errors.exchange}
              >
                <SelectValue
                  render={(_, { value }) =>
                    value ?? (
                      <span className="text-muted-foreground">
                        Select an exchange
                      </span>
                    )
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {EXCHANGES.map((ex) => (
                  <SelectItem key={ex} value={ex}>
                    {ex}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.exchange && (
              <p className="text-xs text-destructive">{errors.exchange}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sector">Sector</Label>
            <Input
              id="sector"
              placeholder="e.g. Technology"
              value={form.sector}
              onChange={(e) => updateField("sector", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this stock..."
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder="Type a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTag}
                className="shrink-0"
              >
                Add
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 rounded-sm hover:bg-foreground/20"
                    >
                      <X className="size-3" />
                      <span className="sr-only">Remove {tag}</span>
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {existingTags && existingTags.filter((t) => !form.tags.includes(t)).length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Existing tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {existingTags
                    .filter((t) => !form.tags.includes(t))
                    .map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }))
                        }
                      >
                        + {tag}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isEditing
                  ? "Saving..."
                  : "Adding..."
                : isEditing
                  ? "Save Changes"
                  : "Add Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
