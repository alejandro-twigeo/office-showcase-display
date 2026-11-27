import { useEffect, useState } from "react";

/**
 * A faint bar along the bottom of a tile that shrinks until the tile switches to something else,
 * so people can feel the change coming. Give it a new `cycleKey` each time the tile switches.
 * Place it inside a `relative` box.
 */
export function SwapTimer({ durationMs, cycleKey }: { durationMs: number; cycleKey: string | number }) {
  const [shrinking, setShrinking] = useState(false);
  useEffect(() => {
    setShrinking(false);
    // next frame: start shrinking from full width
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShrinking(true)));
    return () => cancelAnimationFrame(id);
  }, [cycleKey]);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-[clamp(14px,1.3vw,28px)] bottom-[clamp(5px,0.4vw,8px)] h-[3px] overflow-hidden rounded-full motion-reduce:hidden"
    >
      <div
        className="h-full rounded-full bg-primary/25"
        style={{
          width: shrinking ? "0%" : "100%",
          transition: shrinking ? `width ${durationMs}ms linear` : "none",
        }}
      />
    </div>
  );
}
