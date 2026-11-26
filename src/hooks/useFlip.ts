import { useLayoutEffect, useRef } from "react";

/**
 * Slide list items to their new place when the order changes (FLIP).
 * Mark each item with data-flip="<stable key>" inside the container.
 */
export function useFlip<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);
  const prev = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, DOMRect>();
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      const key = el.dataset.flip!;
      const rect = el.getBoundingClientRect();
      next.set(key, rect);
      const before = prev.current.get(key);
      if (!before || reduced) return;
      const dx = before.left - rect.left;
      const dy = before.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
        duration: 600,
        easing: "cubic-bezier(.2,.8,.2,1)",
      });
    });
    prev.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
