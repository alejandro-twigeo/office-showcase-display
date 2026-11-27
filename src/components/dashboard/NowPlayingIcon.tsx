import { useEffect, useRef } from "react";
import { nowPlayingIcon } from "@/assets/nowPlayingIcon";

// The icon's own pinch: squeeze in, spring out, settle
const PINCH: Keyframe[] = [
  { transform: "scale(1, 1)" },
  { transform: "scale(0.8, 1.08)", offset: 0.3 },
  { transform: "scale(1.1, 0.95)", offset: 0.6 },
  { transform: "scale(0.97, 1.02)", offset: 0.82 },
  { transform: "scale(1, 1)" },
];

/**
 * The small icon in front of "Now playing". It sits still, and does a little pinch once when a
 * new song starts (and on hover on a laptop), so nothing loops forever on the TV.
 */
export function NowPlayingIcon({ songId }: { songId?: string }) {
  const img = useRef<HTMLImageElement>(null);

  const pinch = () => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const el = img.current;
    if (!el || el.getAnimations().length) return;
    el.animate(PINCH, { duration: 700, easing: "ease-out" });
  };

  // New song: pinch once
  useEffect(() => {
    if (songId) pinch();
  }, [songId]);

  return (
    <img
      ref={img}
      src={nowPlayingIcon}
      alt="Now playing"
      draggable={false}
      onMouseEnter={pinch}
      className="h-auto w-[clamp(20px,1.4vw,28px)] shrink-0 select-none"
    />
  );
}
