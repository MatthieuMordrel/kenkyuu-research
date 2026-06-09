/** Pause execution in Node actions (used for OpenAI start stagger). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
