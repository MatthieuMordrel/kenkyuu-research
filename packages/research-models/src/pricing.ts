import type {
  ModelPricing,
  NormalizedUsage,
  ResearchModelDefinition,
} from "./types";

/**
 * Estimate USD cost for a completed job from registry pricing and usage stats.
 */
export function estimateModelCost(
  model: Pick<ResearchModelDefinition, "pricing">,
  usage: NormalizedUsage
): number {
  return estimateCostFromPricing(model.pricing, usage);
}

/**
 * Estimate USD cost from raw pricing constants (shared by tests and adapters).
 */
export function estimateCostFromPricing(
  pricing: ModelPricing,
  usage: NormalizedUsage
): number {
  const tokenCost =
    (usage.inputTokens * pricing.inputPerM +
      usage.outputTokens * pricing.outputPerM) /
    1_000_000;
  const searchCost =
    (usage.webSearchRequests ?? 0) * (pricing.webSearchPerCall ?? 0);
  const sessionCost =
    ((usage.durationMs ?? 0) / 3_600_000) * (pricing.sessionPerHour ?? 0);
  return tokenCost + searchCost + sessionCost;
}
