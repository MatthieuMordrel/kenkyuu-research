import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { SymbolSuggestion } from "@/hooks/use-stock-symbol-lookup";

interface StockSymbolComboboxProps {
  query: string;
  onQueryChange: (value: string) => void;
  suggestions: SymbolSuggestion[];
  isLoading: boolean;
  listOpen: boolean;
  onListOpenChange: (open: boolean) => void;
  onSelect: (suggestion: SymbolSuggestion) => void;
  invalid?: boolean;
  errorMessage?: string;
  helperText?: string;
}

/**
 * Ticker / company search field with Finnhub suggestion list (add-stock flow).
 */
export function StockSymbolCombobox({
  query,
  onQueryChange,
  suggestions,
  isLoading,
  listOpen,
  onListOpenChange,
  onSelect,
  invalid,
  errorMessage,
  helperText,
}: StockSymbolComboboxProps) {
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions, query]);

  useEffect(() => {
    if (!listOpen) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onListOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [listOpen, onListOpenChange]);

  function openList() {
    onListOpenChange(true);
  }

  function selectAt(index: number) {
    const item = suggestions[index];
    if (!item) {
      return;
    }
    onSelect(item);
    onListOpenChange(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!listOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      openList();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectAt(activeIndex);
      return;
    }

    if (event.key === "Escape") {
      onListOpenChange(false);
    }
  }

  const showList =
    listOpen && query.trim().length >= 2 && (isLoading || suggestions.length > 0);

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <Label htmlFor="stock-symbol-search">Ticker or company *</Label>
      <div className="relative">
        <Input
          id="stock-symbol-search"
          placeholder="e.g. AAPL or Apple"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            openList();
          }}
          onFocus={openList}
          onKeyDown={handleKeyDown}
          aria-invalid={invalid}
          aria-expanded={showList}
          aria-controls={showList ? listboxId : undefined}
          aria-autocomplete="list"
          autoCapitalize="characters"
          autoComplete="off"
          role="combobox"
        />
        {isLoading && (
          <Loader2
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>

      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}

      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="max-h-48 overflow-y-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {isLoading && suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Searching…
            </li>
          ) : (
            suggestions.map((item, index) => (
              <li
                key={`${item.finnhubSymbol}-${item.displaySymbol}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  className={cn(
                    "flex w-full min-h-11 flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent",
                    index === activeIndex && "bg-accent"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectAt(index)}
                >
                  <span className="font-medium">{item.displaySymbol}</span>
                  <span className="truncate text-muted-foreground">
                    {item.companyName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.securityType}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {listOpen &&
        query.trim().length >= 2 &&
        !isLoading &&
        suggestions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No matches. Enter details manually below.
          </p>
        )}
    </div>
  );
}
