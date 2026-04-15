import { cn } from "@/lib/utils";
import { STOCK_MODE_OPTIONS, type StockStepProps } from "./constants";

export function StockStep({
  form,
  errors,
  stocks,
  tags,
  isSingleStock,
  updateStockSelection,
  toggleTag,
  toggleStock,
}: StockStepProps) {
  return (
    <div className="flex flex-col gap-3">
      {isSingleStock && (
        <p className="text-xs text-muted-foreground">
          This prompt analyzes one stock at a time. When multiple stocks are
          selected, it will run once per stock.
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STOCK_MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() =>
              updateStockSelection({
                type: option.value,
                tags:
                  option.value === "tagged"
                    ? (form.stockSelection.tags ?? [])
                    : undefined,
                stockIds:
                  option.value === "specific"
                    ? (form.stockSelection.stockIds ?? [])
                    : undefined,
              })
            }
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all",
              form.stockSelection.type === option.value
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-foreground/20 hover:bg-accent/50"
            )}
          >
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {option.description}
            </span>
          </button>
        ))}
      </div>

      {/* All stocks info */}
      {form.stockSelection.type === "all" && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-sm text-muted-foreground">
            The prompt will run on all{" "}
            <span className="font-medium text-foreground">
              {stocks?.length ?? "..."}
            </span>{" "}
            stocks in your database.
            {isSingleStock && " One job will be created per stock."}
          </p>
        </div>
      )}

      {/* Tag selector */}
      {form.stockSelection.type === "tagged" && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Select tags:</span>
          {tags && tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const selected =
                  form.stockSelection.tags?.includes(tag) ?? false;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No tags available. Tag your stocks first.
            </p>
          )}
        </div>
      )}

      {/* Specific stock selector */}
      {form.stockSelection.type === "specific" && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Select stocks:</span>
          {stocks && stocks.length > 0 ? (
            <div className="flex flex-col gap-1">
              {stocks.map((stock) => {
                const selected =
                  form.stockSelection.stockIds?.includes(stock._id) ?? false;
                return (
                  <button
                    key={stock._id}
                    type="button"
                    onClick={() => toggleStock(stock._id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-foreground/20 hover:bg-accent/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {selected && "✓"}
                    </span>
                    <span className="font-semibold">{stock.ticker}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {stock.companyName}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No stocks available. Add stocks first.
            </p>
          )}
        </div>
      )}

      {errors.stockSelection && (
        <p className="text-xs text-destructive">{errors.stockSelection}</p>
      )}
    </div>
  );
}
