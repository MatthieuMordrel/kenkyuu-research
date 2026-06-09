import type { PollResult } from "../../providers";
import type { ResearchModelDefinition } from "@repo/research-models/types";

/** Human-readable health-check message for a provider poll result. */
export function statusMessage(
  model: ResearchModelDefinition,
  result: PollResult,
  elapsedMin: number
): string {
  switch (result.status) {
    case "running":
      return `${model.label} is running (${elapsedMin}m elapsed). This is normal for deep research.`;
    case "completed":
      return `${model.label} reports completed — processing will follow shortly.`;
    case "failed":
      return `${model.label} reports failed: ${result.error}`;
    case "cancelled":
      return `${model.label} reports cancelled.`;
  }
}
