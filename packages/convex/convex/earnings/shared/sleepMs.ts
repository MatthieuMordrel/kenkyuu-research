/** Resolve after the given number of milliseconds (rate-limit pacing). */
export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
