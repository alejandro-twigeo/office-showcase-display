/**
 * Someone is writing: three small balls in Twigeo oranges that hop one after the other, each
 * with two softer copies trailing behind it. Inspired by Uiverse's ball loader (lesimpleliott).
 */
const ORANGES = ["hsl(22 100% 56%)", "hsl(32 100% 58%)", "hsl(14 92% 52%)"];

export function TypingDots({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label ?? "Someone is writing"} title={label} className={`inline-flex items-center gap-[0.32em] ${className}`}>
      {ORANGES.map((color, g) => (
        <span key={g} className="relative block h-[0.55em] w-[0.55em]">
          {[0, 1, 2].map((t) => (
            <span
              key={t}
              className="typing-ball absolute inset-0 rounded-full"
              style={{
                background: color,
                opacity: 1 - t * 0.35,
                transform: `scale(${1 - t * 0.18})`,
                animationDelay: `${g * 0.16 + t * 0.06}s`,
              }}
            />
          ))}
        </span>
      ))}
      <style>{`
        @keyframes typing-hop {
          0%, 60%, 100% { translate: 0 0; }
          30% { translate: 0 -0.5em; }
        }
        .typing-ball { animation: typing-hop 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite; }
        @media (prefers-reduced-motion: reduce) { .typing-ball { animation: none; } }
      `}</style>
    </span>
  );
}
