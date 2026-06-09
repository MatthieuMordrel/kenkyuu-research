"use node";

import { RESEARCH_PROVIDERS, type ProviderName } from "../../providers";

/** User-facing error for a provider whose API key is not configured. */
export function missingKeyMessage(providerId: ProviderName): string {
  return `${RESEARCH_PROVIDERS[providerId].label} API key not configured. Set it in Settings.`;
}
