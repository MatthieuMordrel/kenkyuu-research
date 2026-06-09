/** Patch fragment that clears all format-pass tracking fields on a research job. */
export const clearFormatTrackingFields = {
  formatExternalId: undefined,
  formatStartedAt: undefined,
  formatAttempts: undefined,
} as const;
