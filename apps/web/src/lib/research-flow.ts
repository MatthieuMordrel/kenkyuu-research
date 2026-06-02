import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { GenericId } from "convex/values";
import {
  DEFAULT_RESEARCH_MODEL_ID,
  getActiveResearchModels,
  getResearchModel,
  getResearchModelLabel,
  resolveStoredModelId,
} from "@repo/research-models/resolve";
import type { ResearchModelId } from "@repo/research-models/types";
import { RESEARCH_MODELS } from "@repo/research-models/models";

export type { ResearchModelId, ProviderId } from "@repo/research-models/types";

export type ResearchFlowStep =
  | "prompt-selection"
  | "stock-selection"
  | "provider-confirm"
  | "executing";

/** Active models available in research and prompt pickers. */
export const ACTIVE_RESEARCH_MODELS = getActiveResearchModels();

export const DEFAULT_MODEL_ID: ResearchModelId = DEFAULT_RESEARCH_MODEL_ID;

/** @deprecated Use getResearchModelLabel(modelId) */
export function getModelLabel(modelId: ResearchModelId): string {
  return getResearchModelLabel(modelId);
}

/**
 * Resolve a stored model id, including legacy provider-only prompt defaults.
 */
export function resolvePromptModelId(args: {
  defaultModelId?: string | null;
  defaultProvider?: "openai" | "anthropic" | null;
}): ResearchModelId {
  return resolveStoredModelId({
    modelId: args.defaultModelId,
    provider: args.defaultProvider,
  });
}

interface ResearchFlowState {
  step: ResearchFlowStep;
  promptId: GenericId<"prompts"> | null;
  promptType: "single-stock" | "multi-stock" | "discovery" | null;
  stockIds: GenericId<"stocks">[];
  modelId: ResearchModelId;
  isOpen: boolean;
}

interface ResearchFlowActions {
  /** Open the research wizard at the first step */
  open: () => void;
  /** Close the wizard and reset all state */
  close: () => void;
  /**
   * Select a prompt and advance to the next step.
   * The prompt's default model seeds modelId for this run;
   * the user can still override it in the confirm step.
   */
  selectPrompt: (
    promptId: GenericId<"prompts">,
    promptType: "single-stock" | "multi-stock" | "discovery",
    defaultModelId?: ResearchModelId,
    defaultProvider?: "openai" | "anthropic"
  ) => void;
  /** Select stocks and advance to model confirmation */
  selectStocks: (stockIds: GenericId<"stocks">[]) => void;
  /** Pick a model for this run (overrides the prompt default) */
  selectModel: (modelId: ResearchModelId) => void;
  /** Confirm model and move to executing step */
  confirmModel: () => void;
  /** Mark execution as started (called after mutation succeeds) */
  markExecuting: () => void;
  /** Go back one step */
  back: () => void;
  /** Reset to initial state */
  reset: () => void;
}

type ResearchFlowStore = ResearchFlowState & ResearchFlowActions;

const initialState: ResearchFlowState = {
  step: "prompt-selection",
  promptId: null,
  promptType: null,
  stockIds: [],
  modelId: DEFAULT_MODEL_ID,
  isOpen: false,
};

export const useResearchFlowStore = create<ResearchFlowStore>()((set, get) => ({
  ...initialState,

  open: () => set({ ...initialState, isOpen: true }),

  close: () => set(initialState),

  selectPrompt: (promptId, promptType, defaultModelId, defaultProvider) => {
    const nextStep =
      promptType === "discovery" ? "provider-confirm" : "stock-selection";
    set({
      promptId,
      promptType,
      stockIds: [],
      modelId: resolvePromptModelId({
        defaultModelId,
        defaultProvider,
      }),
      step: nextStep,
    });
  },

  selectStocks: (stockIds) => {
    set({ stockIds, step: "provider-confirm" });
  },

  selectModel: (modelId) => {
    set({ modelId });
  },

  confirmModel: () => {
    set({ step: "executing" });
  },

  markExecuting: () => {
    set({ step: "executing" });
  },

  back: () => {
    const { step, promptType } = get();
    switch (step) {
      case "stock-selection":
        set({ step: "prompt-selection", promptId: null, promptType: null });
        break;
      case "provider-confirm":
        if (promptType === "discovery") {
          set({ step: "prompt-selection", promptId: null, promptType: null });
        } else {
          set({ step: "stock-selection", stockIds: [] });
        }
        break;
      default:
        break;
    }
  },

  reset: () => set(initialState),
}));

export const useResearchFlowStep = () => useResearchFlowStore((s) => s.step);
export const useResearchFlowIsOpen = () =>
  useResearchFlowStore((s) => s.isOpen);
export const useResearchFlowPromptId = () =>
  useResearchFlowStore((s) => s.promptId);
export const useResearchFlowPromptType = () =>
  useResearchFlowStore((s) => s.promptType);
export const useResearchFlowStockIds = () =>
  useResearchFlowStore((s) => s.stockIds);
export const useResearchFlowModelId = () =>
  useResearchFlowStore((s) => s.modelId);

export const useResearchFlowActions = () =>
  useResearchFlowStore(
    useShallow((s) => ({
      open: s.open,
      close: s.close,
      selectPrompt: s.selectPrompt,
      selectStocks: s.selectStocks,
      selectModel: s.selectModel,
      confirmModel: s.confirmModel,
      markExecuting: s.markExecuting,
      back: s.back,
      reset: s.reset,
    }))
  );

/** Estimated cost label for a model id. */
export function getModelCostEstimate(modelId: ResearchModelId): string {
  return getResearchModel(modelId).estimatedCostLabel;
}

/** Registry lookup re-exported for UI components. */
export { RESEARCH_MODELS, getResearchModel, getResearchModelLabel };
