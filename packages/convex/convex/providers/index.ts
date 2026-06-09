"use node";

import {
  getResearchModel,
  resolveStoredModelId,
} from "@repo/research-models/resolve";
import type {
  ResearchHarnessId,
  ResearchModelDefinition,
} from "@repo/research-models/types";
import { anthropicAdapter } from "./anthropic";
import { anthropicManagedAgentsAdapter } from "./anthropicManagedAgents";
import { openaiAdapter } from "./openai";
import type { ResearchProviderAdapter } from "./types";
import type { ProviderName } from "./constants";

const ADAPTERS: Record<ResearchHarnessId, ResearchProviderAdapter> = {
  "openai-responses": openaiAdapter,
  "anthropic-batch": anthropicAdapter,
  "anthropic-managed-agents": anthropicManagedAgentsAdapter,
};

/**
 * Returns the execution adapter for a model's harness.
 */
export function getHarnessAdapter(
  model: Pick<ResearchModelDefinition, "harnessId">
): ResearchProviderAdapter {
  return ADAPTERS[model.harnessId];
}

/**
 * Resolves the model definition for a stored job or prompt row.
 */
export function resolveJobModel(args: {
  modelId?: string | null;
  provider?: ProviderName | null;
}): ResearchModelDefinition {
  const modelId = resolveStoredModelId(args);
  return getResearchModel(modelId);
}

export type {
  ResearchProviderAdapter,
  PollResult,
  NormalizedUsage,
} from "./types";
export {
  ACTIVE_PROVIDER_NAMES,
  assertModelActive,
  assertProviderActive,
  DEFAULT_MODEL_ID,
  estimateModelCost,
  getResearchModel,
  getResearchModelLabel,
  getSettingsKeyForModel,
  getSettingsKeyForProvider,
  isModelActive,
  isProviderActive,
  jobFieldsForModel,
  modelIdValidator,
  providerValidator,
  resolveActiveModelId,
  resolveMutationModelId,
  resolveStoredModelId,
  RESEARCH_MODELS,
  RESEARCH_PROVIDERS,
  SETTING_KEY_BY_PROVIDER,
} from "./constants";
export type {
  ActiveProviderName,
  ProviderName,
  ResearchModelId,
} from "./constants";
