import { useCallback, useEffect, useState } from "react";

/**
 * Returns a `Date.now()` value that refreshes at the given interval (default 30 s).
 * Useful for relative time displays ("5m ago") that need periodic updates.
 */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now);

  const tick = useCallback(() => setNow(Date.now()), []);

  useEffect(() => {
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, tick]);

  return now;
}
