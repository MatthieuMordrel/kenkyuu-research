import { useCallback } from "react";
import {
  useResearchFlowStore,
  useResearchFlowActions,
  useResearchFlowStep,
  useResearchFlowIsOpen,
  useResearchFlowPromptId,
  useResearchFlowPromptType,
  useResearchFlowStockIds,
  useResearchFlowProvider,
} from "@/lib/research-flow";
import { useStartResearch } from "./use-research";

/**
 * Orchestrates the research wizard flow by combining
 * the Zustand state machine with Convex mutations.
 *
 * Usage:
 *   const flow = useResearchFlow();
 *   flow.open();               // open wizard
 *   flow.selectPrompt(id, t);  // step 1: pick prompt
 *   flow.selectStocks([...]);  // step 2: pick stocks
 *   await flow.execute();      // step 3: confirm & run
 */
export function useResearchFlow() {
  const step = useResearchFlowStep();
  const isOpen = useResearchFlowIsOpen();
  const promptId = useResearchFlowPromptId();
  const promptType = useResearchFlowPromptType();
  const stockIds = useResearchFlowStockIds();
  const provider = useResearchFlowProvider();
  const actions = useResearchFlowActions();
  const startResearch = useStartResearch();

  const canExecute =
    promptId !== null &&
    (promptType === "discovery" || stockIds.length > 0);

  const execute = useCallback(async () => {
    if (!promptId) {
      throw new Error("No prompt selected");
    }
    if (promptType !== "discovery" && stockIds.length === 0) {
      throw new Error("No stocks selected");
    }

    actions.confirmProvider();

    const jobId = await startResearch({
      promptId,
      stockIds,
      provider,
    });

    actions.markExecuting();
    return jobId;
  }, [promptId, promptType, stockIds, provider, actions, startResearch]);

  return {
    // State
    step,
    isOpen,
    promptId,
    promptType,
    stockIds,
    provider,
    canExecute,

    // Actions
    open: actions.open,
    close: actions.close,
    selectPrompt: actions.selectPrompt,
    selectStocks: actions.selectStocks,
    back: actions.back,
    reset: actions.reset,
    execute,
  } as const;
}

// Re-export types for consumers
export type { ResearchFlowStep } from "@/lib/research-flow";

// Re-export individual selectors for components that only need one piece
export {
  useResearchFlowStep,
  useResearchFlowIsOpen,
} from "@/lib/research-flow";

// Direct store access for non-React contexts
export const getResearchFlowState = () => useResearchFlowStore.getState();
