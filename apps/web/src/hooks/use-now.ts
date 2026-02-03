import { useSyncExternalStore } from "react";

/**
 * Returns a `Date.now()` value that refreshes at the given interval (default 30 s).
 * Uses `useSyncExternalStore` for concurrent-mode safety.
 */
export function useNow(intervalMs = 30_000) {
  return useSyncExternalStore(
    (onStoreChange) => {
      const id = setInterval(onStoreChange, intervalMs);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
  );
}
