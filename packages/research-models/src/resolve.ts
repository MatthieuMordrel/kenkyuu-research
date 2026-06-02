import { RESEARCH_MODELS, RESEARCH_MODEL_IDS } from "./models";
import { RESEARCH_PROVIDERS } from "./providers";
import type {
  ProviderId,
  ResearchModelDefinition,
  ResearchModelId,
  ResearchProviderDefinition,
} from "./types";

/** Default model for new prompts and jobs when none is specified. */
export const DEFAULT_RESEARCH_MODEL_ID: ResearchModelId =
  "anthropic/claude-opus-4-8";

/**
 * Maps legacy `provider`-only records to their default model.
 * Used while migrating stored documents that predate modelId.
 */
export const LEGACY_PROVIDER_DEFAULT_MODEL: Record<ProviderId, ResearchModelId> =
  {
    anthropic: "anthropic/claude-opus-4-8",
    openai: "openai/gpt-5.5",
  };

/**
 * Look up a model by registry id. Throws if unknown.
 */
export function getResearchModel(modelId: string): ResearchModelDefinition {
  const model = RESEARCH_MODELS[modelId as ResearchModelId];
  if (!model) {
    throw new Error(`Unknown research model: ${modelId}`);
  }
  return model;
}

/**
 * Look up provider metadata by id.
 */
export function getResearchProvider(
  providerId: ProviderId
): ResearchProviderDefinition {
  return RESEARCH_PROVIDERS[providerId];
}

/** Models available in UI pickers (active only). */
export function getActiveResearchModels(): ResearchModelDefinition[] {
  return RESEARCH_MODEL_IDS.map((id) => RESEARCH_MODELS[id]).filter(
    (model) => model.active
  );
}

/** Whether a model can be selected for new prompts, schedules, or jobs. */
export function isModelActive(modelId: string): boolean {
  try {
    return getResearchModel(modelId).active;
  } catch {
    return false;
  }
}

/**
 * Reject disabled models at mutation boundaries (prompt/schedule config).
 */
export function assertModelActive(modelId: string): void {
  const model = getResearchModel(modelId);
  if (!model.active) {
    throw new Error(
      `${model.label} is currently disabled. Choose an active model instead.`
    );
  }
}

/**
 * Upgrade inactive models to the default active model when starting jobs.
 * Existing records that reference disabled models keep working via this path.
 */
export function resolveActiveModelId(modelId: string): ResearchModelId {
  const model = getResearchModel(modelId);
  if (model.active) {
    return model.id;
  }
  return DEFAULT_RESEARCH_MODEL_ID;
}

/**
 * Resolve the model for a stored job/prompt, supporting legacy provider-only rows.
 */
export function resolveStoredModelId(args: {
  modelId?: string | null;
  provider?: ProviderId | null;
}): ResearchModelId {
  if (args.modelId) {
    return resolveActiveModelId(args.modelId);
  }
  if (args.provider) {
    return resolveActiveModelId(LEGACY_PROVIDER_DEFAULT_MODEL[args.provider]);
  }
  return DEFAULT_RESEARCH_MODEL_ID;
}

/**
 * Denormalized fields to persist alongside modelId on jobs and schedules.
 */
export function jobFieldsForModel(modelId: ResearchModelId): {
  modelId: ResearchModelId;
  provider: ProviderId;
} {
  const model = getResearchModel(modelId);
  return { modelId: model.id, provider: model.providerId };
}

/** Display label for a model, with fallback for unknown ids. */
export function getResearchModelLabel(modelId: string): string {
  try {
    return getResearchModel(modelId).label;
  } catch {
    return modelId;
  }
}

/** Settings key for the API key belonging to a model. */
export function getSettingsKeyForModel(modelId: string): string {
  const model = getResearchModel(modelId);
  return RESEARCH_PROVIDERS[model.providerId].settingsKey;
}

/** Settings key for a provider id. */
export function getSettingsKeyForProvider(providerId: ProviderId): string {
  return RESEARCH_PROVIDERS[providerId].settingsKey;
}

/** Whether any registered model from this provider is active. */
export function isProviderActive(providerId: ProviderId): boolean {
  return RESEARCH_MODEL_IDS.some(
    (id) =>
      RESEARCH_MODELS[id].providerId === providerId && RESEARCH_MODELS[id].active
  );
}
