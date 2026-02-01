import { create } from "zustand";
import type { GenericId } from "convex/values";

export type ResearchFlowStep =
  | "prompt-selection"
  | "stock-selection"
  | "provider-confirm"
  | "executing";

interface ResearchFlowState {
  step: ResearchFlowStep;
  promptId: GenericId<"prompts"> | null;
  promptType: "single-stock" | "multi-stock" | "discovery" | null;
  stockIds: GenericId<"stocks">[];
  provider: "openai";
  isOpen: boolean;
}

interface ResearchFlowActions {
  /** Open the research wizard at the first step */
  open: () => void;
  /** Close the wizard and reset all state */
  close: () => void;
  /** Select a prompt and advance to the next step */
  selectPrompt: (
    promptId: GenericId<"prompts">,
    promptType: "single-stock" | "multi-stock" | "discovery",
  ) => void;
  /** Select stocks and advance to provider confirmation */
  selectStocks: (stockIds: GenericId<"stocks">[]) => void;
  /** Confirm provider and move to executing step */
  confirmProvider: () => void;
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
  provider: "openai",
  isOpen: false,
};

export const useResearchFlowStore = create<ResearchFlowStore>()((set, get) => ({
  ...initialState,

  open: () => set({ ...initialState, isOpen: true }),

  close: () => set(initialState),

  selectPrompt: (promptId, promptType) => {
    // Discovery prompts skip stock selection entirely
    const nextStep =
      promptType === "discovery" ? "provider-confirm" : "stock-selection";
    set({
      promptId,
      promptType,
      stockIds: [],
      step: nextStep,
    });
  },

  selectStocks: (stockIds) => {
    set({ stockIds, step: "provider-confirm" });
  },

  confirmProvider: () => {
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

// Atomic selectors
export const useResearchFlowStep = () =>
  useResearchFlowStore((s) => s.step);
export const useResearchFlowIsOpen = () =>
  useResearchFlowStore((s) => s.isOpen);
export const useResearchFlowPromptId = () =>
  useResearchFlowStore((s) => s.promptId);
export const useResearchFlowPromptType = () =>
  useResearchFlowStore((s) => s.promptType);
export const useResearchFlowStockIds = () =>
  useResearchFlowStore((s) => s.stockIds);
export const useResearchFlowProvider = () =>
  useResearchFlowStore((s) => s.provider);

// Actions hook
export const useResearchFlowActions = () =>
  useResearchFlowStore((s) => ({
    open: s.open,
    close: s.close,
    selectPrompt: s.selectPrompt,
    selectStocks: s.selectStocks,
    confirmProvider: s.confirmProvider,
    markExecuting: s.markExecuting,
    back: s.back,
    reset: s.reset,
  }));
