import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateSchedule, useUpdateSchedule } from "@/hooks/use-schedules";
import { usePrompts } from "@/hooks/use-prompts";
import { useStocks, useTags } from "@/hooks/use-stocks";
import { useEarningsSummary } from "@/hooks/use-earnings";
import {
  validateScheduleForm,
  hasErrors,
  getAllowedStockModes,
  generateScheduleName,
  type ScheduleFormData,
  type ScheduleFormErrors,
  type PromptType,
} from "@/lib/schedule-validation";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PROVIDER,
  resolveActiveProvider,
  type ProviderName,
} from "@/lib/research-flow";
import type { Doc, Id } from "@repo/convex/dataModel";

import {
  FREQUENCY_PRESETS,
  INITIAL_FORM,
  WIZARD_STEPS,
  type WizardStep,
} from "./constants";
import { PromptStep } from "./prompt-step";
import { StockStep } from "./stock-step";
import { ScheduleStep } from "./schedule-step";

interface ScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: Doc<"schedules"> | null;
}

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

      if (
        selectedPromptType === "discovery" &&
        next.triggerType === "earnings"
      ) {
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
        const triggerType = (schedule.triggerType ?? "cron") as
          | "cron"
          | "earnings";
        setForm({
          name: schedule.name,
          promptId: schedule.promptId,
          stockSelection: { ...schedule.stockSelection },
          triggerType,
          cron: schedule.cron ?? "@daily",
          earningsConfig: schedule.earningsConfig
            ? {
                ...schedule.earningsConfig,
                earningsMode: schedule.earningsConfig.earningsMode ?? "each",
              }
            : { ...INITIAL_FORM.earningsConfig },
          timezone: schedule.timezone ?? "America/New_York",
        });
        if (triggerType === "cron") {
          const isPreset = FREQUENCY_PRESETS.some(
            (p) => p.value === schedule.cron
          );
          setFrequencyMode(isPreset ? (schedule.cron ?? "@daily") : "custom");
        }
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
    value: ScheduleFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof ScheduleFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function updateStockSelection(
    updates: Partial<ScheduleFormData["stockSelection"]>
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
        if (
          !form.stockSelection.tags ||
          form.stockSelection.tags.length === 0
        ) {
          stepErrors.stockSelection = "Select at least one tag";
        }
      }
      if (form.stockSelection.type === "specific") {
        if (
          !form.stockSelection.stockIds ||
          form.stockSelection.stockIds.length === 0
        ) {
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
        stocks ?? undefined
      );
      const commonFields = {
        name: autoName,
        promptId: form.promptId as Id<"prompts">,
        stockSelection:
          form.stockSelection as Doc<"schedules">["stockSelection"],
        enabled: true,
        triggerType: form.triggerType as "cron" | "earnings",
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
        // Schedules inherit the selected prompt's default provider. To change
        // provider for a schedule, update the prompt's default.
        const provider = resolveActiveProvider(
          (selectedPrompt?.defaultProvider ?? DEFAULT_PROVIDER) as ProviderName
        );
        await createSchedule({
          ...commonFields,
          ...triggerFields,
          provider,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

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
                          : "bg-muted text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : isCompleted
                          ? "bg-primary/20 text-primary"
                          : "bg-foreground/10 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? "✓" : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "h-px flex-1",
                      i < stepIndex ? "bg-primary/30" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          {step === "prompt" && (
            <PromptStep
              form={form}
              setForm={setForm}
              errors={errors}
              updateField={updateField}
              updateStockSelection={updateStockSelection}
              prompts={prompts}
              promptSearch={promptSearch}
              setPromptSearch={setPromptSearch}
              setErrors={setErrors}
            />
          )}

          {step === "stocks" && (
            <StockStep
              form={form}
              setForm={setForm}
              errors={errors}
              updateField={updateField}
              updateStockSelection={updateStockSelection}
              stocks={stocks}
              tags={tags}
              isSingleStock={isSingleStock}
              toggleTag={toggleTag}
              toggleStock={toggleStock}
            />
          )}

          {step === "schedule" && (
            <ScheduleStep
              form={form}
              setForm={setForm}
              errors={errors}
              updateField={updateField}
              updateStockSelection={updateStockSelection}
              selectedPromptType={selectedPromptType}
              selectedPrompt={selectedPrompt}
              isDiscovery={isDiscovery}
              frequencyMode={frequencyMode}
              handleFrequencyChange={handleFrequencyChange}
              stocks={stocks}
              resolvedStockIds={resolvedStockIds}
              earningsSummary={earningsSummary}
              submitError={submitError}
            />
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
