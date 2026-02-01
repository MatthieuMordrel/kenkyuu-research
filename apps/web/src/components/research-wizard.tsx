import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useResearchFlow } from "@/hooks/use-research-flow";
import { usePrompts } from "@/hooks/use-prompts";
import { useStocks, useTags } from "@/hooks/use-stocks";
import { useActiveJobs } from "@/hooks/use-research";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Play,
  Search,
  Zap,
} from "lucide-react";
import type { Doc } from "@repo/convex/dataModel";
import type { GenericId } from "convex/values";

const STEP_LABELS: Record<string, string> = {
  "prompt-selection": "Select Prompt",
  "stock-selection": "Select Stocks",
  "provider-confirm": "Confirm & Run",
  executing: "Running",
};

const STEP_ORDER = [
  "prompt-selection",
  "stock-selection",
  "provider-confirm",
] as const;

export function ResearchWizard() {
  const flow = useResearchFlow();

  return (
    <Dialog open={flow.isOpen} onOpenChange={(open) => !open && flow.close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Research</DialogTitle>
          <DialogDescription>
            {STEP_LABELS[flow.step] ?? "Research"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <StepIndicator
          currentStep={flow.step}
          promptType={flow.promptType}
        />

        {/* Step content */}
        {flow.step === "prompt-selection" && <PromptSelectionStep />}
        {flow.step === "stock-selection" && <StockSelectionStep />}
        {flow.step === "provider-confirm" && <ProviderConfirmStep />}
        {flow.step === "executing" && <ExecutingStep />}
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({
  currentStep,
  promptType,
}: {
  currentStep: string;
  promptType: string | null;
}) {
  const steps: readonly string[] =
    promptType === "discovery"
      ? ["prompt-selection", "provider-confirm"]
      : STEP_ORDER;

  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex items-center gap-2 px-1">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          {i > 0 && (
            <ChevronRight className="size-3 text-muted-foreground shrink-0" />
          )}
          <span
            className={cn(
              "text-xs font-medium",
              i === currentIndex
                ? "text-primary"
                : i < currentIndex
                  ? "text-muted-foreground"
                  : "text-muted-foreground/50",
            )}
          >
            {STEP_LABELS[step]}
          </span>
        </div>
      ))}
    </div>
  );
}

function PromptSelectionStep() {
  const prompts = usePrompts();
  const flow = useResearchFlow();

  if (prompts === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No prompts found. Create a prompt first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt._id}
          type="button"
          onClick={() => flow.selectPrompt(prompt._id, prompt.type)}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
          )}
        >
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{prompt.name}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {prompt.type}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground line-clamp-2">
              {prompt.description}
            </span>
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function StockSelectionStep() {
  const flow = useResearchFlow();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const stocks = useStocks({ search, tag: selectedTag });
  const tags = useTags();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(flow.stockIds),
  );

  function toggleStock(id: GenericId<"stocks">) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (flow.promptType === "single-stock") {
          // Single-stock: only allow one
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
  }

  function handleContinue() {
    flow.selectStocks(Array.from(selected) as GenericId<"stocks">[]);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search stocks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tag filters */}
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

      {/* Selected count */}
      <div className="text-xs text-muted-foreground">
        {selected.size} stock{selected.size !== 1 ? "s" : ""} selected
        {flow.promptType === "single-stock" && " (max 1)"}
      </div>

      {/* Stock list */}
      <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5">
        {stocks === undefined ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : stocks.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No stocks found
          </div>
        ) : (
          stocks.map((stock) => (
            <StockSelectItem
              key={stock._id}
              stock={stock}
              isSelected={selected.has(stock._id)}
              onToggle={() => toggleStock(stock._id)}
            />
          ))
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={flow.back}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={selected.size === 0}
        >
          Continue
          <ChevronRight className="size-4" />
        </Button>
      </DialogFooter>
    </div>
  );
}

function StockSelectItem({
  stock,
  isSelected,
  onToggle,
}: {
  stock: Doc<"stocks">;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-accent",
      )}
    >
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
          isSelected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30",
        )}
      >
        {isSelected && <Check className="size-3" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{stock.ticker}</span>
          <span className="text-xs text-muted-foreground">
            {stock.exchange}
          </span>
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {stock.companyName}
        </span>
      </div>
      {stock.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 shrink-0">
          {stock.tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </button>
  );
}

function ProviderConfirmStep() {
  const flow = useResearchFlow();
  const activeJobs = useActiveJobs();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slotsUsed = activeJobs?.count ?? 0;
  const slotsLimit = activeJobs?.limit ?? 5;
  const hasCapacity = slotsUsed < slotsLimit;

  async function handleRun() {
    setError(null);
    setSubmitting(true);
    try {
      await flow.execute();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start research");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <Card className="py-3">
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Provider</span>
            <div className="flex items-center gap-1.5">
              <Zap className="size-3.5 text-primary" />
              <span className="font-medium">OpenAI Deep Research</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Prompt Type</span>
            <Badge variant="outline" className="text-xs">
              {flow.promptType}
            </Badge>
          </div>
          {flow.promptType !== "discovery" && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stocks</span>
              <span className="font-medium">
                {flow.stockIds.length} selected
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Est. Cost</span>
            <span className="font-medium">~$3-4</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Active Jobs</span>
            <span
              className={cn(
                "font-medium",
                !hasCapacity && "text-destructive",
              )}
            >
              {slotsUsed}/{slotsLimit}
            </span>
          </div>
        </CardContent>
      </Card>

      {!hasCapacity && (
        <p className="text-xs text-destructive">
          Maximum concurrent jobs reached. Wait for an active job to complete or
          cancel one before starting a new research.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={flow.back}
          disabled={submitting}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleRun}
          disabled={submitting || !flow.canExecute || !hasCapacity}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="size-4" />
              Run Research
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

function ExecutingStep() {
  const flow = useResearchFlow();

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">Research started</p>
        <p className="text-xs text-muted-foreground mt-1">
          Your research job has been queued. You can track its progress in the
          active jobs panel.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={flow.close}>
        Close
      </Button>
    </div>
  );
}
