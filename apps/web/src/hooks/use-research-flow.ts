import { useCallback } from "react";
import {
  useResearchFlowStore,
  useResearchFlowActions,
  useResearchFlowStep,
  useResearchFlowIsOpen,
  useResearchFlowPromptId,
  useResearchFlowPromptType,
  useResearchFlowStockIds,
  useResearchFlowModelId,
} from "@/lib/research-flow";
import { useStartResearch } from "./use-research";

/**
 * Orchestrates the research wizard flow by combining
 * the Zustand state machine with Convex mutations.
 */
export function useResearchFlow() {
  const step = useResearchFlowStep();
  const isOpen = useResearchFlowIsOpen();
  const promptId = useResearchFlowPromptId();
  const promptType = useResearchFlowPromptType();
  const stockIds = useResearchFlowStockIds();
  const modelId = useResearchFlowModelId();
  const actions = useResearchFlowActions();
  const startResearch = useStartResearch();

  const canExecute =
    promptId !== null && (promptType === "discovery" || stockIds.length > 0);

  const execute = useCallback(async () => {
    if (!promptId) {
      throw new Error("No prompt selected");
    }
    if (promptType !== "discovery" && stockIds.length === 0) {
      throw new Error("No stocks selected");
    }

    actions.confirmModel();

    const jobId = await startResearch({
      promptId,
      stockIds,
      modelId,
    });

    actions.markExecuting();
    return jobId;
  }, [promptId, promptType, stockIds, modelId, actions, startResearch]);

  return {
    step,
    isOpen,
    promptId,
    promptType,
    stockIds,
    modelId,
    canExecute,
    open: actions.open,
    close: actions.close,
    selectPrompt: actions.selectPrompt,
    selectStocks: actions.selectStocks,
    selectModel: actions.selectModel,
    back: actions.back,
    reset: actions.reset,
    execute,
  } as const;
}

export type { ResearchFlowStep, ResearchModelId } from "@/lib/research-flow";
export {
  ACTIVE_RESEARCH_MODELS,
  getModelCostEstimate,
  getModelLabel,
  getResearchModelLabel,
  RESEARCH_MODELS,
} from "@/lib/research-flow";

export {
  useResearchFlowStep,
  useResearchFlowIsOpen,
} from "@/lib/research-flow";

export const getResearchFlowState = () => useResearchFlowStore.getState();
