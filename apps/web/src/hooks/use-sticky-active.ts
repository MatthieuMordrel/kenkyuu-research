import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Result of {@link useStickyActive}.
 *
 * @property sentinelRef - Ref callback for a sentinel element placed immediately above the sticky target
 * @property isStuck - True when the sticky target has scrolled past its natural position
 */
interface UseStickyActiveResult {
  sentinelRef: (node: HTMLDivElement | null) => void;
  isStuck: boolean;
}

/**
 * Detects when a sticky element is actively stuck using a sentinel and IntersectionObserver.
 *
 * Mount the returned `sentinelRef` on a zero-height element directly above the sticky node.
 * When the sentinel leaves the viewport, `isStuck` becomes true so callers can adjust styling.
 *
 * @param enabled - When false, no observer is attached and `isStuck` remains false
 */
export function useStickyActive(enabled: boolean): UseStickyActiveResult {
  const [isStuck, setIsStuck] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!enabled || !node) {
        setIsStuck(false);
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsStuck(!entry.isIntersecting);
        },
        { threshold: [0, 1] }
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [enabled]
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return { sentinelRef, isStuck };
}
