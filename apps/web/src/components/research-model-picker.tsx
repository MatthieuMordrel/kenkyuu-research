import {
  formatModelDetailOption,
  getResearchModelDetailRows,
} from "@repo/research-models/model-details";
import { RESEARCH_HARNESSES } from "@repo/research-models/harnesses";
import type {
  ResearchHarnessId,
  ResearchModelDefinition,
} from "@repo/research-models/types";
import { getResearchModel } from "@repo/research-models/resolve";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResearchModelId } from "@/lib/research-flow";

interface ResearchModelPickerProps {
  /** Currently selected model id */
  value: ResearchModelId;
  /** Called when the user picks a different model */
  onChange: (modelId: ResearchModelId) => void;
  /** Models shown in the picker (defaults to all active models) */
  models: readonly ResearchModelDefinition[];
  /** Field label above the picker */
  label?: string;
}

/**
 * Model selector with an expandable configuration panel for the selected model.
 * Shows effort, tool limits, and other registry metadata when a model is clicked.
 */
export function ResearchModelPicker({
  value,
  onChange,
  models,
  label = "Model",
}: ResearchModelPickerProps) {
  const selectedModel = getResearchModel(value);
  const detailRows = getResearchModelDetailRows(selectedModel);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>

      <div
        className={cn(
          "grid gap-2",
          models.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
        )}
      >
        {models.map((model) => {
          const selected = value === model.id;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onChange(model.id)}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:bg-accent"
              )}
            >
              <Zap
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  selected ? "text-primary" : "text-muted-foreground"
                )}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium">
                    {model.label}
                  </span>
                  <HarnessBadge harnessId={model.harnessId} />
                </div>
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {model.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <ResearchModelDetailsPanel
        rows={detailRows}
        modelLabel={selectedModel.label}
      />
    </div>
  );
}

interface HarnessBadgeProps {
  /** Harness id of the model card being rendered */
  harnessId: ResearchHarnessId;
}

/**
 * Chip distinguishing execution harnesses (direct API vs hosted agent) on
 * model cards. Rendered on every card so dimensions stay identical.
 */
function HarnessBadge({ harnessId }: HarnessBadgeProps) {
  const harness = RESEARCH_HARNESSES[harnessId];
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none",
        harness.kind === "agent"
          ? "bg-primary/10 text-primary ring-1 ring-primary/30"
          : "bg-muted text-muted-foreground ring-1 ring-border/60"
      )}
    >
      {harness.label}
    </span>
  );
}

interface ResearchModelDetailsPanelProps {
  /** Spec rows for the selected model */
  rows: ReturnType<typeof getResearchModelDetailRows>;
  /** Label of the selected model */
  modelLabel: string;
}

/**
 * Read-only panel listing runtime configuration for the selected model.
 */
function ResearchModelDetailsPanel({
  rows,
  modelLabel,
}: ResearchModelDetailsPanelProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {modelLabel} configuration
      </p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-1 text-xs sm:col-span-1"
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd>
              {row.options ? (
                <ModelDetailOptionChips
                  options={row.options}
                  active={row.value}
                />
              ) : (
                <span className="font-medium tabular-nums">{row.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

interface ModelDetailOptionChipsProps {
  /** All known values for this setting */
  options: readonly string[];
  /** Currently active value (matches registry) */
  active: string;
}

/**
 * Renders enum-like model settings as chips, highlighting the active value.
 */
function ModelDetailOptionChips({
  options,
  active,
}: ModelDetailOptionChipsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const isActive = option === active;
        return (
          <span
            key={option}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-background/80 text-muted-foreground ring-1 ring-border/60"
            )}
          >
            {formatModelDetailOption(option)}
          </span>
        );
      })}
    </div>
  );
}
