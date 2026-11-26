import { useEffect, useRef, useState } from "react";

/**
 * A number that counts to its new value instead of jumping (about 0.7 s, easing out).
 * The first value shows straight away; only changes animate. Respects reduced motion.
 */
export function CountUp({ value, duration = 700, className }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (value - from) * eased);
      setShown(v);
      fromRef.current = v;
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className}>{shown}</span>;
}
