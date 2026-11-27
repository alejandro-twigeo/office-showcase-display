/**
 * Hand-drawn marks in the spirit of the Twigeo slide template (circles, underlines, arrows,
 * hearts), drawn as SVG so they stay sharp on the TV and take the theme's orange.
 * Each one draws itself in when it appears (or when its `key` changes).
 */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  pathLength: 1,
};

/** A wobbly marker underline, stretched to the width of what it sits under */
export function HandUnderline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden className={`squiggle-draw overflow-visible text-primary ${className}`}>
      <path {...stroke} strokeWidth={3.2} vectorEffect="non-scaling-stroke" d="M3 9.5 C 35 4.5, 70 11, 104 7 S 165 5.5, 197 8.5" />
      <path {...stroke} strokeWidth={2.2} vectorEffect="non-scaling-stroke" style={{ animationDelay: "0.45s" }} d="M28 12 C 70 9, 120 12.5, 176 10" />
    </svg>
  );
}

/** A loose hand-drawn ring around something; place it absolutely over the element */
export function HandCircle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden className={`squiggle-draw pointer-events-none overflow-visible text-primary ${className}`}>
      <path
        {...stroke}
        strokeWidth={2.4}
        vectorEffect="non-scaling-stroke"
        d="M70 6 C 35 3, 6 12, 5 30 C 4 49, 36 57, 64 56 C 95 55, 117 46, 116 29 C 115 13, 92 4, 58 5 C 46 5.5, 38 8, 30 12"
      />
    </svg>
  );
}

/** A curly arrow pointing right */
export function HandArrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" aria-hidden className={`squiggle-draw overflow-visible text-primary ${className}`}>
      <path {...stroke} strokeWidth={2.6} d="M4 30 C 12 12, 26 8, 32 18 C 37 27, 26 32, 24 24 C 22 15, 38 9, 58 14" />
      <path {...stroke} strokeWidth={2.6} style={{ animationDelay: "0.7s" }} d="M48 7 L 58.5 14 L 49 21.5" />
    </svg>
  );
}

/** A small hand-drawn heart */
export function HandHeart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 36" aria-hidden className={`squiggle-draw overflow-visible text-primary ${className}`}>
      <path {...stroke} strokeWidth={2.6} d="M20 33 C 8 24, 2 17, 3.5 10 C 5 3, 14 1.5, 19.5 9 C 24 1.5, 35 2, 36.5 10 C 38 18, 31 25, 20.5 32.5" />
    </svg>
  );
}
