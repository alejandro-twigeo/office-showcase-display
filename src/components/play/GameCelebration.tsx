import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CountUp } from "@/components/ui/count-up";

const COLORS = ["hsl(22 100% 56%)", "#16a34a", "#eab308", "#ec4899", "#3b82f6", "#f97316"];

function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.6,
        size: 6 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        round: Math.random() > 0.6,
        drift: (Math.random() - 0.5) * 140,
      })),
    [count]
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-[-4%]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

interface GameCelebrationProps {
  /** Show it (the moment the game is won) */
  open: boolean;
  emoji: string;
  title: string;
  /** Points, counted up from 0. Leave out while they're still being worked out. */
  points?: number | null;
  /** Small lines under the points, e.g. "in 2:31", "1.2 km away" */
  details?: string[];
  /** Big wins get confetti; a near miss doesn't */
  confetti?: boolean;
  onClose?: () => void;
}

/**
 * End-of-game moment, on top of everything so nobody has to scroll to see how they did:
 * confetti, the points counting up, and the key numbers. Tap anywhere (or "Nice!") to close.
 */
export function GameCelebration({ open, emoji, title, points, details = [], confetti = true, onClose }: GameCelebrationProps) {
  const [visible, setVisible] = useState(open);
  useEffect(() => setVisible(open), [open]);
  // Start at 0 and then move to the real points, so they visibly count up
  const [shownPoints, setShownPoints] = useState(0);
  useEffect(() => {
    if (!visible || points == null) return;
    setShownPoints(0);
    const t = setTimeout(() => setShownPoints(points), 300);
    return () => clearTimeout(t);
  }, [visible, points]);
  if (!visible) return null;

  const close = () => {
    setVisible(false);
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/30 p-6 animate-in fade-in duration-300"
      onClick={close}
      role="dialog"
      aria-label={title}
    >
      {confetti && <Confetti />}
      <div
        className="relative w-full max-w-xs rounded-3xl bg-card px-6 pb-5 pt-6 text-center shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] animate-in zoom-in-75 fade-in duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl leading-none pairs-pop">{emoji}</div>
        <p className="mt-3 text-xl font-bold tracking-tight">{title}</p>
        {points != null && (
          <p className="mt-2 text-5xl font-bold tabular-nums text-primary">
            +<CountUp value={shownPoints} duration={900} />
            <span className="ml-1 text-lg font-semibold text-muted-foreground">pts</span>
          </p>
        )}
        {details.length > 0 && (
          <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
            {details.map((d) => (
              <p key={d}>{d}</p>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={close}
          className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] transition-transform"
        >
          Nice!
        </button>
      </div>
    </div>,
    document.body
  );
}
