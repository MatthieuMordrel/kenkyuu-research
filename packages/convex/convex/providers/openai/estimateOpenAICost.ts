import type { NormalizedUsage } from "../types";
import { estimateModelCost } from "@repo/research-models/pricing";
import { RESEARCH_MODELS } from "@repo/research-models/models";

/** @internal Exported for testing — uses o3-deep-research registry pricing */
export function estimateOpenAICost(usage: NormalizedUsage): number {
  return estimateModelCost(RESEARCH_MODELS["openai/o3-deep-research"], usage);
}
