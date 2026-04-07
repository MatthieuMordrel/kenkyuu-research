import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCreateSchedule, useUpdateSchedule } from "@/hooks/use-schedules";
import { usePrompts } from "@/hooks/use-prompts";
import { useStocks, useTags } from "@/hooks/use-stocks";
import { useEarningsSummary } from "@/hooks/use-earnings";
import {
  validateScheduleForm,
  hasErrors,
  describeCron,
  describeEarningsTrigger,
  getAllowedStockModes,
  computeNextCronRun,
  formatNextRun,
  generateScheduleName,
  COMMON_TIMEZONES,
  type ScheduleFormData,
  type ScheduleFormErrors,
  type EarningsConfigFormData,
  type PromptType,
  type EarningsMode,
} from "@/lib/schedule-validation";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@repo/convex/dataModel";

interface ScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: Doc<"schedules"> | null;
}

type StockSelectionType = "all" | "tagged" | "specific" | "none";

const FREQUENCY_PRESETS = [
  { label: "Hourly", value: "@hourly" },
  { label: "Daily (midnight)", value: "@daily" },
  { label: "Weekly (Sunday)", value: "@weekly" },
  { label: "Monthly (1st)", value: "@monthly" },
  { label: "Custom", value: "custom" },
] as const;

const STOCK_MODE_OPTIONS: {
  value: StockSelectionType;
  label: string;
  description: string;
}[] = [
  { value: "all", label: "All Stocks", description: "Run on every stock in your database" },
  { value: "tagged", label: "By Tag", description: "Run on stocks matching selected tags" },
  { value: "specific", label: "Specific", description: "Choose individual stocks" },
];

const INITIAL_EARNINGS_CONFIG: EarningsConfigFormData = {
  offsetDays: 0,
  adjustForHour: true,
  earningsMode: "each",
};

const EARNINGS_MODE_OPTIONS: {
  value: EarningsMode;
  label: string;
  description: string;
}[] = [
  { value: "each", label: "Each Earning", description: "Trigger once per stock as it reports" },
  { value: "after_last", label: "After Last", description: "Wait until all stocks have reported" },
  { value: "before_first", label: "Before First", description: "Trigger on the earliest report date" },
];

const INITIAL_FORM: ScheduleFormData = {
  name: "",
  promptId: "",
  stockSelection: { type: "all" },
  triggerType: "cron",
  cron: "@daily",
  earningsConfig: { ...INITIAL_EARNINGS_CONFIG },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

const OFFSET_OPTIONS = [
  { value: -3, label: "3 days before" },
  { value: -2, label: "2 days before" },
  { value: -1, label: "1 day before" },
  { value: 0, label: "On earnings day" },
  { value: 1, label: "1 day after" },
  { value: 2, label: "2 days after" },
  { value: 3, label: "3 days after" },
  { value: 5, label: "5 days after" },
  { value: 7, label: "7 days after" },
  { value: 14, label: "14 days after" },
] as const;

const PROMPT_TYPE_CONFIG: Record<
  PromptType,
  { label: string; className: string }
> = {
  "single-stock": {
    label: "Single Stock",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  "multi-stock": {
    label: "Multi Stock",
    className: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
  discovery: {
    label: "Discovery",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

const WIZARD_STEPS = [
  { key: "prompt", label: "Prompt" },
  { key: "stocks", label: "Stocks" },
  { key: "schedule", label: "Schedule" },
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number]["key"];

export function ScheduleModal({
  open,
  onOpenChange,
  schedule,
}: ScheduleModalProps) {
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const prompts = usePrompts();
  const stocks = useStocks();
  const tags = useTags();
  const earningsSummary = useEarningsSummary();
  const isEditing = !!schedule;

  const [form, setForm] = useState<ScheduleFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ScheduleFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [frequencyMode, setFrequencyMode] = useState<string>("@daily");
  const [step, setStep] = useState<WizardStep>("prompt");
  const [promptSearch, setPromptSearch] = useState("");

  // Derive prompt type from selected prompt
  const selectedPrompt = prompts?.find((p) => p._id === form.promptId) ?? null;
  const selectedPromptType: PromptType | null = selectedPrompt?.type ?? null;
  const isDiscovery = selectedPromptType === "discovery";
  const isSingleStock = selectedPromptType === "single-stock";

  // Filter prompts by search
  const filteredPrompts = useMemo(() => {
    if (!prompts) return undefined;
    if (!promptSearch.trim()) return prompts;
    const q = promptSearch.toLowerCase();
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q),
    );
  }, [prompts, promptSearch]);

  // Resolve selected stock IDs for earnings preview
  const resolvedStockIds = useMemo(() => {
    if (!stocks) return [];
    const sel = form.stockSelection;
    if (sel.type === "all") return stocks.map((s) => s._id);
    if (sel.type === "tagged") {
      const selectedTags = sel.tags ?? [];
      if (selectedTags.length === 0) return [];
      return stocks
        .filter((s) => s.tags?.some((t: string) => selectedTags.includes(t)))
        .map((s) => s._id);
    }
    return sel.stockIds ?? [];
  }, [stocks, form.stockSelection]);

  // Auto-correct stock selection and trigger type when prompt type changes
  useEffect(() => {
    if (!selectedPromptType) return;

    const allowed = getAllowedStockModes(selectedPromptType);
    let stockModeCorrected = false;

    setForm((prev) => {
      let next = prev;

      if (!allowed.includes(prev.stockSelection.type)) {
        const defaultMode = allowed[0];
        if (defaultMode) {
          stockModeCorrected = true;
          next = {
            ...next,
            stockSelection: {
              ...next.stockSelection,
              type: defaultMode,
              tags: defaultMode === "tagged" ? [] : undefined,
              stockIds: defaultMode === "specific" ? [] : undefined,
            },
          };
        }
      }

      if (selectedPromptType === "discovery" && next.triggerType === "earnings") {
        next = { ...next, triggerType: "cron" };
      }

      return next === prev ? prev : next;
    });

    setErrors((prev) => {
      if (!stockModeCorrected) return prev;
      if (!prev.stockSelection) return prev;
      return { ...prev, stockSelection: undefined };
    });
  }, [selectedPromptType]);

  useEffect(() => {
    if (open) {
      if (schedule) {
        const triggerType = (schedule.triggerType ?? "cron") as "cron" | "earnings";
        setForm({
          name: schedule.name,
          promptId: schedule.promptId,
          stockSelection: { ...schedule.stockSelection },
          triggerType,
          cron: schedule.cron ?? "@daily",
          earningsConfig: schedule.earningsConfig
            ? { ...schedule.earningsConfig, earningsMode: schedule.earningsConfig.earningsMode ?? "each" }
            : { ...INITIAL_EARNINGS_CONFIG },
          timezone: schedule.timezone ?? "America/New_York",
        });
        if (triggerType === "cron") {
          const isPreset = FREQUENCY_PRESETS.some(
            (p) => p.value === schedule.cron,
          );
          setFrequencyMode(isPreset ? (schedule.cron ?? "@daily") : "custom");
        }
        // Start on step 1 even when editing
        setStep("prompt");
      } else {
        setForm(INITIAL_FORM);
        setFrequencyMode("@daily");
        setStep("prompt");
      }
      setErrors({});
      setSubmitError(null);
      setPromptSearch("");
    }
  }, [open, schedule]);

  function updateField<K extends keyof ScheduleFormData>(
    field: K,
    value: ScheduleFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof ScheduleFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function updateStockSelection(
    updates: Partial<ScheduleFormData["stockSelection"]>,
  ) {
    setForm((prev) => ({
      ...prev,
      stockSelection: { ...prev.stockSelection, ...updates },
    }));
    if (errors.stockSelection) {
      setErrors((prev) => ({ ...prev, stockSelection: undefined }));
    }
  }

  function handleFrequencyChange(preset: string) {
    setFrequencyMode(preset);
    if (preset !== "custom") {
      updateField("cron", preset);
    }
  }

  function toggleTag(tag: string) {
    const currentTags = form.stockSelection.tags ?? [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    updateStockSelection({ tags: newTags });
  }

  function toggleStock(stockId: Id<"stocks">) {
    const currentIds = form.stockSelection.stockIds ?? [];
    const newIds = currentIds.includes(stockId)
      ? currentIds.filter((id) => id !== stockId)
      : [...currentIds, stockId];
    updateStockSelection({ stockIds: newIds });
  }

  // Step navigation
  function getNextStep(): WizardStep | null {
    if (step === "prompt") return isDiscovery ? "schedule" : "stocks";
    if (step === "stocks") return "schedule";
    return null;
  }

  function getPrevStep(): WizardStep | null {
    if (step === "schedule") return isDiscovery ? "prompt" : "stocks";
    if (step === "stocks") return "prompt";
    return null;
  }

  function validateCurrentStep(): boolean {
    const stepErrors: ScheduleFormErrors = {};

    if (step === "prompt") {
      if (!form.promptId) {
        stepErrors.promptId = "Select a prompt to continue";
      }
    } else if (step === "stocks") {
      if (form.stockSelection.type === "tagged") {
        if (!form.stockSelection.tags || form.stockSelection.tags.length === 0) {
          stepErrors.stockSelection = "Select at least one tag";
        }
      }
      if (form.stockSelection.type === "specific") {
        if (!form.stockSelection.stockIds || form.stockSelection.stockIds.length === 0) {
          stepErrors.stockSelection = "Select at least one stock";
        }
      }
    }

    setErrors(stepErrors);
    return !hasErrors(stepErrors);
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    const next = getNextStep();
    if (next) setStep(next);
  }

  function goBack() {
    const prev = getPrevStep();
    if (prev) {
      setErrors({});
      setStep(prev);
    }
  }

  async function handleSubmit() {
    setSubmitError(null);

    const validationErrors = validateScheduleForm(form, selectedPromptType);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSubmitting(true);
    try {
      const autoName = generateScheduleName(
        selectedPrompt?.name ?? "Untitled",
        form.stockSelection,
        stocks ?? undefined,
      );
      const commonFields = {
        name: autoName,
        promptId: form.promptId as Id<"prompts">,
        stockSelection: form.stockSelection as Doc<"schedules">["stockSelection"],
        enabled: true,
        triggerType: form.triggerType as "cron" | "earnings",
        // Only include timezone for cron schedules.
        // Earnings schedules derive timezone from each stock's exchange.
        ...(form.triggerType === "cron" ? { timezone: form.timezone } : {}),
      };

      const triggerFields =
        form.triggerType === "earnings"
          ? { earningsConfig: form.earningsConfig }
          : { cron: form.cron };

      if (isEditing && schedule) {
        await updateSchedule({
          id: schedule._id,
          ...commonFields,
          ...triggerFields,
        });
      } else {
        await createSchedule({
          ...commonFields,
          ...triggerFields,
          provider: "openai",
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

  // Determine which step index is active (for stepper display)
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Schedule" : "Create Schedule"}
          </DialogTitle>
          <DialogDescription>
            {step === "prompt"
              ? "Choose a research prompt to run on a schedule."
              : step === "stocks"
                ? "Choose which stocks to include."
                : "Configure when this schedule runs."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-1">
          {WIZARD_STEPS.map((s, i) => {
            const isActive = step === s.key;
            const isCompleted = i < stepIndex;
            const isSkipped = s.key === "stocks" && isDiscovery;

            return (
              <div key={s.key} className="flex flex-1 items-center gap-1">
                <button
                  type="button"
                  disabled={!isCompleted}
                  onClick={() => isCompleted && setStep(s.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                        : isSkipped
                          ? "bg-muted/50 text-muted-foreground/50 line-through"
                          : "bg-muted text-muted-foreground",
                  )}
                >
                  <span className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : isCompleted
                        ? "bg-primary/20 text-primary"
                        : "bg-foreground/10 text-muted-foreground",
                  )}>
                    {isCompleted ? "✓" : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={cn(
                    "h-px flex-1",
                    i < stepIndex ? "bg-primary/30" : "bg-border",
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          {/* Step 1: Prompt selection */}
          {step === "prompt" && (
            <div className="flex flex-col gap-3">
              {prompts === undefined ? (
                <div className="flex flex-col gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : prompts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No prompts available. Create a prompt first.
                  </p>
                </div>
              ) : (
                <>
                  {/* Search */}
                  {prompts.length > 5 && (
                    <Input
                      placeholder="Search prompts..."
                      value={promptSearch}
                      onChange={(e) => setPromptSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                  )}

                  {/* Prompt list */}
                  <div className="flex flex-col gap-1.5">
                    {filteredPrompts?.length === 0 && (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No prompts match your search.
                      </p>
                    )}
                    {filteredPrompts?.map((prompt) => {
                      const isSelected = form.promptId === prompt._id;
                      const typeConfig = PROMPT_TYPE_CONFIG[prompt.type as PromptType];

                      return (
                        <button
                          key={prompt._id}
                          type="button"
                          onClick={() => {
                            updateField("promptId", prompt._id);
                            setErrors((prev) => ({ ...prev, promptId: undefined }));
                          }}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-foreground/20 hover:bg-accent/50",
                          )}
                        >
                          {/* Radio indicator */}
                          <span className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                            isSelected
                              ? "border-primary"
                              : "border-muted-foreground/30",
                          )}>
                            {isSelected && (
                              <span className="size-2 rounded-full bg-primary" />
                            )}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{prompt.name}</span>
                              {typeConfig && (
                                <Badge
                                  variant="outline"
                                  className={cn("shrink-0 text-[10px] px-1.5 py-0", typeConfig.className)}
                                >
                                  {typeConfig.label}
                                </Badge>
                              )}
                            </div>
                            {prompt.description && (
                              <span className="text-xs text-muted-foreground line-clamp-2">
                                {prompt.description}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {errors.promptId && (
                <p className="text-xs text-destructive">{errors.promptId}</p>
              )}
            </div>
          )}

          {/* Step 2: Stock configuration */}
          {step === "stocks" && (
            <div className="flex flex-col gap-3">
              {isSingleStock && (
                <p className="text-xs text-muted-foreground">
                  This prompt analyzes one stock at a time. When multiple stocks are selected, it will run once per stock.
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
                        tags: option.value === "tagged" ? (form.stockSelection.tags ?? []) : undefined,
                        stockIds: option.value === "specific" ? (form.stockSelection.stockIds ?? []) : undefined,
                      })
                    }
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all",
                      form.stockSelection.type === option.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-foreground/20 hover:bg-accent/50",
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
                    stocks in your database.{isSingleStock && " One job will be created per stock."}
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
                        const selected = form.stockSelection.tags?.includes(tag) ?? false;
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground hover:bg-accent",
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
                        const selected = form.stockSelection.stockIds?.includes(stock._id) ?? false;
                        return (
                          <button
                            key={stock._id}
                            type="button"
                            onClick={() => toggleStock(stock._id)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all",
                              selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : "border-border hover:border-foreground/20 hover:bg-accent/50",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/30",
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
          )}

          {/* Step 3: Schedule configuration */}
          {step === "schedule" && (
            <div className="flex flex-col gap-4">
              {/* Auto-generated name preview */}
              <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Schedule name</p>
                <p className="text-sm font-medium">
                  {generateScheduleName(
                    selectedPrompt?.name ?? "Untitled",
                    form.stockSelection,
                    stocks ?? undefined,
                  )}
                </p>
              </div>

              {/* Trigger Type */}
              <div className="flex flex-col gap-2">
                <Label>Trigger Type *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateField("triggerType", "cron")}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all",
                      form.triggerType === "cron"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-foreground/20 hover:bg-accent/50",
                    )}
                  >
                    <span className="text-sm font-medium">Time-based</span>
                    <span className="text-[11px] text-muted-foreground">
                      Run on a fixed cron schedule
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isDiscovery}
                    onClick={() => updateField("triggerType", "earnings")}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all",
                      form.triggerType === "earnings"
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-foreground/20 hover:bg-accent/50",
                      isDiscovery && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className="text-sm font-medium">Earnings-based</span>
                    <span className="text-[11px] text-muted-foreground">
                      {isDiscovery
                        ? "Not available for discovery prompts"
                        : "Run relative to earnings dates"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Frequency (cron) */}
              {form.triggerType === "cron" && (
                <div className="flex flex-col gap-2">
                  <Label>Frequency *</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {FREQUENCY_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handleFrequencyChange(preset.value)}
                        className={cn(
                          "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          frequencyMode === preset.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-accent",
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {frequencyMode === "custom" && (
                    <div className="flex flex-col gap-1.5">
                      <Input
                        placeholder="e.g. 0 9 * * 1-5 (weekdays at 9am)"
                        value={form.cron}
                        onChange={(e) => updateField("cron", e.target.value)}
                        aria-invalid={!!errors.cron}
                        className="font-mono text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Format: minute hour day-of-month month day-of-week
                      </p>
                    </div>
                  )}

                  {form.cron && !errors.cron && (
                    <p className="text-xs text-muted-foreground">
                      {describeCron(form.cron)}
                    </p>
                  )}

                  {errors.cron && (
                    <p className="text-xs text-destructive">{errors.cron}</p>
                  )}
                </div>
              )}

              {/* Earnings Config */}
              {form.triggerType === "earnings" && (
                <div className="flex flex-col gap-3">
                  {/* Earnings mode — shown for both single-stock and multi-stock */}
                  {(selectedPromptType === "multi-stock" || selectedPromptType === "single-stock") && (
                    <div className="flex flex-col gap-2">
                      <Label>Trigger Mode *</Label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {EARNINGS_MODE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                earningsConfig: {
                                  ...prev.earningsConfig,
                                  earningsMode: option.value,
                                },
                              }))
                            }
                            className={cn(
                              "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-all",
                              form.earningsConfig.earningsMode === option.value
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : "border-border hover:border-foreground/20 hover:bg-accent/50",
                            )}
                          >
                            <span className="text-sm font-medium">{option.label}</span>
                            <span className="text-[11px] leading-tight text-muted-foreground">
                              {option.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Label>Timing Relative to Earnings *</Label>
                    <select
                      value={form.earningsConfig.offsetDays}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          earningsConfig: {
                            ...prev.earningsConfig,
                            offsetDays: Number(e.target.value),
                          },
                        }))
                      }
                      className={cn(
                        "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      )}
                    >
                      {OFFSET_OPTIONS.map((opt) => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          className="bg-background text-foreground"
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">
                        Adjust for after-market-close
                      </span>
                      <span className="text-xs text-muted-foreground">
                        For AMC earnings on day 0, delay research to the next day
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          earningsConfig: {
                            ...prev.earningsConfig,
                            adjustForHour: !prev.earningsConfig.adjustForHour,
                          },
                        }))
                      }
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        form.earningsConfig.adjustForHour
                          ? "bg-primary"
                          : "bg-muted",
                      )}
                      aria-label={
                        form.earningsConfig.adjustForHour
                          ? "Disable AMC adjustment"
                          : "Enable AMC adjustment"
                      }
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform",
                          form.earningsConfig.adjustForHour
                            ? "translate-x-4"
                            : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {describeEarningsTrigger(form.earningsConfig)}
                  </p>

                  {errors.earningsConfig && (
                    <p className="text-xs text-destructive">
                      {errors.earningsConfig}
                    </p>
                  )}
                </div>
              )}

              {/* Timezone — only for cron schedules */}
              {form.triggerType === "cron" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="schedule-timezone">Timezone *</Label>
                  <select
                    id="schedule-timezone"
                    value={form.timezone}
                    onChange={(e) => updateField("timezone", e.target.value)}
                    className={cn(
                      "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      errors.timezone && "border-destructive",
                    )}
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option
                        key={tz}
                        value={tz}
                        className="bg-background text-foreground"
                      >
                        {tz}
                      </option>
                    ))}
                  </select>
                  {errors.timezone && (
                    <p className="text-xs text-destructive">{errors.timezone}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Timezone is determined automatically from each stock&apos;s exchange.
                </p>
              )}

              {/* Next run preview */}
              <NextRunPreview
                triggerType={form.triggerType}
                cron={form.cron}
                timezone={form.timezone}
                earningsConfig={form.earningsConfig}
                resolvedStockIds={resolvedStockIds}
                earningsSummary={earningsSummary}
              />

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="flex items-center justify-between border-t pt-3">
          <div>
            {getPrevStep() && (
              <Button type="button" variant="ghost" onClick={goBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {step === "schedule" ? (
              <Button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting
                  ? isEditing
                    ? "Saving..."
                    : "Creating..."
                  : isEditing
                    ? "Save Changes"
                    : "Create Schedule"}
              </Button>
            ) : (
              <Button type="button" onClick={goNext}>
                Next
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type EarningsSummaryMap = Record<
  string,
  { previous?: { date: string }; next?: { date: string }; nextNext?: { date: string } }
>;

function NextRunPreview({
  triggerType,
  cron,
  timezone,
  earningsConfig,
  resolvedStockIds,
  earningsSummary,
}: {
  triggerType: "cron" | "earnings";
  cron: string;
  timezone: string;
  earningsConfig: EarningsConfigFormData;
  resolvedStockIds: string[];
  earningsSummary: EarningsSummaryMap | undefined;
}) {
  const nextRun = useMemo(() => {
    if (triggerType !== "cron") return null;
    return computeNextCronRun(cron, timezone);
  }, [triggerType, cron, timezone]);

  const earningsNextRun = useMemo(() => {
    if (triggerType !== "earnings" || !earningsSummary || resolvedStockIds.length === 0) return null;
    const mode = earningsConfig.earningsMode ?? "each";
    const offset = earningsConfig.offsetDays ?? 0;

    const nextDates: string[] = [];
    for (const id of resolvedStockIds) {
      const summary = earningsSummary[id];
      if (summary?.next?.date) nextDates.push(summary.next.date);
    }
    if (nextDates.length === 0) return null;
    nextDates.sort();

    if (mode === "each") {
      const d = new Date(nextDates[0]!);
      d.setDate(d.getDate() + offset);
      return {
        date: d,
        label: `Earliest of ${nextDates.length} stock${nextDates.length > 1 ? "s" : ""}`,
      };
    }
    if (mode === "before_first") {
      const d = new Date(nextDates[0]!);
      d.setDate(d.getDate() + offset);
      return { date: d, label: "Triggers at first earnings date" };
    }
    if (mode === "after_last") {
      const d = new Date(nextDates[nextDates.length - 1]!);
      d.setDate(d.getDate() + offset);
      const missing = resolvedStockIds.length - nextDates.length;
      const note = missing > 0 ? ` (${missing} without date)` : "";
      return { date: d, label: `Triggers after last earnings date${note}` };
    }
    return null;
  }, [triggerType, earningsSummary, resolvedStockIds, earningsConfig]);

  if (triggerType === "earnings") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
        <span className="mt-0.5 text-sm">⏱</span>
        <div className="flex flex-col gap-0.5">
          {earningsNextRun ? (
            <>
              <span className="text-sm font-medium">
                Next run:{" "}
                {earningsNextRun.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {earningsNextRun.label} · Checked hourly
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">Triggers based on earnings dates</span>
              <span className="text-xs text-muted-foreground">
                Checked hourly — triggers when an earnings date matches
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!nextRun) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
      <span className="mt-0.5 text-sm">📅</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Next run: {formatNextRun(nextRun, timezone)}</span>
        <span className="text-xs text-muted-foreground">
          {describeCron(cron)} · {timezone}
        </span>
      </div>
    </div>
  );
}
