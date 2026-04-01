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
import { Badge } from "@/components/ui/badge";
import { useCreateSchedule, useUpdateSchedule } from "@/hooks/use-schedules";
import { usePrompts } from "@/hooks/use-prompts";
import { useStocks, useTags } from "@/hooks/use-stocks";
import {
  validateScheduleForm,
  hasErrors,
  describeCron,
  describeEarningsTrigger,
  COMMON_TIMEZONES,
  type ScheduleFormData,
  type ScheduleFormErrors,
  type EarningsConfigFormData,
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
  { value: "all", label: "All Stocks", description: "Run on all stocks in your database" },
  { value: "tagged", label: "By Tag", description: "Run on stocks matching selected tags" },
  { value: "specific", label: "Specific", description: "Choose individual stocks" },
  { value: "none", label: "None", description: "Discovery prompt, no stocks needed" },
];

const INITIAL_EARNINGS_CONFIG: EarningsConfigFormData = {
  offsetDays: 0,
  runTimeUTC: "10:00",
  adjustForHour: true,
};

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
  const isEditing = !!schedule;

  const [form, setForm] = useState<ScheduleFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<ScheduleFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [frequencyMode, setFrequencyMode] = useState<string>("@daily");

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
            ? { ...schedule.earningsConfig }
            : { ...INITIAL_EARNINGS_CONFIG },
          timezone: schedule.timezone,
        });
        if (triggerType === "cron") {
          const isPreset = FREQUENCY_PRESETS.some(
            (p) => p.value === schedule.cron,
          );
          setFrequencyMode(isPreset ? (schedule.cron ?? "@daily") : "custom");
        }
      } else {
        setForm(INITIAL_FORM);
        setFrequencyMode("@daily");
      }
      setErrors({});
      setSubmitError(null);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validateScheduleForm(form);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSubmitting(true);
    try {
      const commonFields = {
        name: form.name.trim(),
        promptId: form.promptId as Id<"prompts">,
        stockSelection: form.stockSelection as Doc<"schedules">["stockSelection"],
        timezone: form.timezone,
        enabled: true,
        triggerType: form.triggerType as "cron" | "earnings",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Schedule" : "Create Schedule"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the schedule configuration below."
              : "Set up a new automated research schedule."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-name">Name *</Label>
            <Input
              id="schedule-name"
              placeholder="e.g. Weekly Portfolio Review"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Prompt picker */}
          <div className="flex flex-col gap-2">
            <Label>Prompt *</Label>
            {prompts === undefined ? (
              <div className="h-20 animate-pulse rounded-md bg-muted" />
            ) : prompts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No prompts available. Create a prompt first.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto rounded-md border p-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt._id}
                    type="button"
                    onClick={() => updateField("promptId", prompt._id)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-md border p-2 text-left transition-colors",
                      form.promptId === prompt._id
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-accent",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{prompt.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {prompt.type}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {prompt.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {errors.promptId && (
              <p className="text-xs text-destructive">{errors.promptId}</p>
            )}
          </div>

          {/* Stock selection mode */}
          <div className="flex flex-col gap-2">
            <Label>Stock Selection *</Label>
            <div className="grid grid-cols-2 gap-2">
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
                    "flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left transition-colors",
                    form.stockSelection.type === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent",
                  )}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>

            {/* Tag selector */}
            {form.stockSelection.type === "tagged" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Select tags:
                </span>
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
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
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
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  Select stocks:
                </span>
                {stocks && stocks.length > 0 ? (
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto rounded-md border p-2">
                    {stocks.map((stock) => {
                      const selected = form.stockSelection.stockIds?.includes(stock._id) ?? false;
                      return (
                        <button
                          key={stock._id}
                          type="button"
                          onClick={() => toggleStock(stock._id)}
                          className={cn(
                            "flex items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors",
                            selected
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-accent",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border",
                            )}
                          >
                            {selected && "✓"}
                          </span>
                          <span className="font-medium">{stock.ticker}</span>
                          <span className="text-xs text-muted-foreground truncate">
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

          {/* Trigger Type */}
          <div className="flex flex-col gap-2">
            <Label>Trigger Type *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateField("triggerType", "cron")}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left transition-colors",
                  form.triggerType === "cron"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent",
                )}
              >
                <span className="text-sm font-medium">Time-based</span>
                <span className="text-[11px] text-muted-foreground">
                  Run on a fixed cron schedule
                </span>
              </button>
              <button
                type="button"
                onClick={() => updateField("triggerType", "earnings")}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left transition-colors",
                  form.triggerType === "earnings"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent",
                )}
              >
                <span className="text-sm font-medium">Earnings-based</span>
                <span className="text-[11px] text-muted-foreground">
                  Run relative to earnings dates
                </span>
              </button>
            </div>
          </div>

          {/* Frequency (cron-type only) */}
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

          {/* Earnings Config (earnings-type only) */}
          {form.triggerType === "earnings" && (
            <div className="flex flex-col gap-3">
              {/* Offset selector */}
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

              {/* Run time */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="earnings-run-time">Run Time (UTC) *</Label>
                <Input
                  id="earnings-run-time"
                  type="time"
                  value={form.earningsConfig.runTimeUTC}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      earningsConfig: {
                        ...prev.earningsConfig,
                        runTimeUTC: e.target.value,
                      },
                    }))
                  }
                  className="w-32"
                />
                <p className="text-[11px] text-muted-foreground">
                  Time in UTC when research should run on the trigger day
                </p>
              </div>

              {/* Adjust for AMC toggle */}
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
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

              {/* Preview description */}
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

          {/* Timezone */}
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
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
