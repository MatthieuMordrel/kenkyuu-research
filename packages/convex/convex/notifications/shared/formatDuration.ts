/** Formats a millisecond duration as a human-readable string (e.g. "2m 5s"). */
export function formatDuration(ms: number): string {
  if (ms >= 60000) {
    const min = Math.floor(ms / 60000);
    const sec = Math.round((ms % 60000) / 1000);
    return `${min}m ${sec}s`;
  }
  return `${Math.round(ms / 1000)}s`;
}
