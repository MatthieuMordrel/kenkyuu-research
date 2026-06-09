/** Parse "try again in 404ms" / "try again in 6s" out of rate-limit errors. */
export function parseRetryDelayMs(message: string, attempts: number): number {
  const isRateLimit = message.toLowerCase().includes("rate limit");
  if (isRateLimit) {
    const msMatch = message.match(/try again in (\d+)ms/i);
    const sMatch = message.match(/try again in ([\d.]+)s/i);
    const parsedMs = msMatch
      ? parseInt(msMatch[1]!, 10)
      : sMatch
        ? parseFloat(sMatch[1]!) * 1000
        : 0;
    return Math.max(parsedMs + 2000, 5000);
  }
  return Math.pow(2, attempts) * 5000;
}
