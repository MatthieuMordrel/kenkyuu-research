import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeCron,
  describeEarningsTrigger,
  generateScheduleName,
  COMMON_TIMEZONES,
} from "@/lib/schedule-validation";
import { cn } from "@/lib/utils";
import {
  FREQUENCY_PRESETS,
  EARNINGS_MODE_OPTIONS,
  OFFSET_OPTIONS,
  type ScheduleStepProps,
} from "./constants";
import { NextRunPreview } from "./next-run-preview";

export function ScheduleStep({
  form,
  setForm,
  errors,
  updateField,
  selectedPromptType,
  selectedPrompt,
  isDiscovery,
  frequencyMode,
  handleFrequencyChange,
  stocks,
  resolvedStockIds,
  earningsSummary,
  submitError,
}: ScheduleStepProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Auto-generated name preview */}
      <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">Schedule name</p>
        <p className="text-sm font-medium">
          {generateScheduleName(
            selectedPrompt?.name ?? "Untitled",
            form.stockSelection,
            stocks ?? undefined
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
                : "border-border hover:border-foreground/20 hover:bg-accent/50"
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
              isDiscovery && "cursor-not-allowed opacity-40"
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
                    : "border-border bg-background text-foreground hover:bg-accent"
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
          {(selectedPromptType === "multi-stock" ||
            selectedPromptType === "single-stock") && (
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
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                form.earningsConfig.adjustForHour ? "bg-primary" : "bg-muted"
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
                    : "translate-x-0"
                )}
              />
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {describeEarningsTrigger(form.earningsConfig)}
          </p>

          {errors.earningsConfig && (
            <p className="text-xs text-destructive">{errors.earningsConfig}</p>
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
              errors.timezone && "border-destructive"
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

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}
    </div>
  );
}
