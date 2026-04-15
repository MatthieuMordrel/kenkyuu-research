import type {
  ScheduleFormData,
  ScheduleFormErrors,
  EarningsConfigFormData,
  PromptType,
  EarningsMode,
} from "@/lib/schedule-validation";
import type { Id } from "@repo/convex/dataModel";

export type StockSelectionType = "all" | "tagged" | "specific" | "none";

export const FREQUENCY_PRESETS = [
  { label: "Hourly", value: "@hourly" },
  { label: "Daily (midnight)", value: "@daily" },
  { label: "Weekly (Sunday)", value: "@weekly" },
  { label: "Monthly (1st)", value: "@monthly" },
  { label: "Custom", value: "custom" },
] as const;

export const STOCK_MODE_OPTIONS: {
  value: StockSelectionType;
  label: string;
  description: string;
}[] = [
  {
    value: "all",
    label: "All Stocks",
    description: "Run on every stock in your database",
  },
  {
    value: "tagged",
    label: "By Tag",
    description: "Run on stocks matching selected tags",
  },
  {
    value: "specific",
    label: "Specific",
    description: "Choose individual stocks",
  },
];

export const INITIAL_EARNINGS_CONFIG: EarningsConfigFormData = {
  offsetDays: 0,
  adjustForHour: true,
  earningsMode: "each",
};

export const EARNINGS_MODE_OPTIONS: {
  value: EarningsMode;
  label: string;
  description: string;
}[] = [
  {
    value: "each",
    label: "Each Earning",
    description: "Trigger once per stock as it reports",
  },
  {
    value: "after_last",
    label: "After Last",
    description: "Wait until all stocks have reported",
  },
  {
    value: "before_first",
    label: "Before First",
    description: "Trigger on the earliest report date",
  },
];

export const INITIAL_FORM: ScheduleFormData = {
  name: "",
  promptId: "",
  stockSelection: { type: "all" },
  triggerType: "cron",
  cron: "@daily",
  earningsConfig: { ...INITIAL_EARNINGS_CONFIG },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const OFFSET_OPTIONS = [
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

export const PROMPT_TYPE_CONFIG: Record<
  PromptType,
  { label: string; className: string }
> = {
  "single-stock": {
    label: "Single Stock",
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  "multi-stock": {
    label: "Multi Stock",
    className:
      "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  },
  discovery: {
    label: "Discovery",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

export const WIZARD_STEPS = [
  { key: "prompt", label: "Prompt" },
  { key: "stocks", label: "Stocks" },
  { key: "schedule", label: "Schedule" },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number]["key"];

export type EarningsSummaryMap = Record<
  string,
  {
    previous?: { date: string };
    next?: { date: string };
    nextNext?: { date: string };
  }
>;

/** Props shared across wizard step components */
export interface StepProps {
  form: ScheduleFormData;
  setForm: React.Dispatch<React.SetStateAction<ScheduleFormData>>;
  errors: ScheduleFormErrors;
  updateField: <K extends keyof ScheduleFormData>(
    field: K,
    value: ScheduleFormData[K]
  ) => void;
  updateStockSelection: (
    updates: Partial<ScheduleFormData["stockSelection"]>
  ) => void;
}

export interface PromptStepProps extends StepProps {
  prompts:
    | Array<{ _id: string; name: string; description?: string; type: string }>
    | undefined;
  promptSearch: string;
  setPromptSearch: (v: string) => void;
  setErrors: React.Dispatch<React.SetStateAction<ScheduleFormErrors>>;
}

export interface StockStepProps extends StepProps {
  stocks:
    | Array<{
        _id: Id<"stocks">;
        ticker: string;
        companyName: string;
        tags?: string[];
      }>
    | undefined;
  tags: string[] | undefined;
  isSingleStock: boolean;
  toggleTag: (tag: string) => void;
  toggleStock: (stockId: Id<"stocks">) => void;
}

export interface ScheduleStepProps extends StepProps {
  selectedPromptType: PromptType | null;
  selectedPrompt: { name: string } | null;
  isDiscovery: boolean;
  frequencyMode: string;
  handleFrequencyChange: (preset: string) => void;
  stocks:
    | Array<{ _id: Id<"stocks">; ticker: string; companyName: string }>
    | undefined;
  resolvedStockIds: string[];
  earningsSummary: EarningsSummaryMap | undefined;
  submitError: string | null;
}
