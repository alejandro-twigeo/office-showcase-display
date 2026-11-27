import { useState } from "react";
import { REACTION_EMOJIS } from "@/hooks/useKudosReactions";

interface Props {
  reactions: { emoji: string; count: number; names: string[]; mine: boolean }[];
  /** Called with an emoji to react (or take it back). Leave out where nobody can react. */
  onReact?: (emoji: string) => void;
  /** Size: the TV scales with the screen, the phone uses fixed sizes */
  size?: "tv" | "phone";
}

/**
 * Reactions under a kudos: each emoji with its count, plus a small "＋☺" button so people know
 * they can react. Tapping it opens the six emojis; tapping one of yours takes it back.
 */
export function ReactionBar({ reactions, onReact, size = "phone" }: Props) {
  const [picking, setPicking] = useState(false);
  const tv = size === "tv";
  const chip = tv
    ? "rounded-full px-[0.6em] py-[0.15em] text-[clamp(12px,0.85vw,18px)]"
    : "rounded-full px-2 py-0.5 text-xs";

  return (
    <div className="flex flex-wrap items-center gap-[0.35em]" onClick={(e) => e.stopPropagation()}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          title={r.names.join(", ")}
          disabled={!onReact}
          onClick={() => onReact?.(r.emoji)}
          className={`${chip} inline-flex items-center gap-[0.3em] border tabular-nums transition-colors ${
            r.mine ? "border-primary/50 bg-primary/15" : "border-border bg-background/70"
          } ${onReact ? "hover:border-primary/50" : "cursor-default"}`}
        >
          <span className="leading-none">{r.emoji}</span>
          <span className="font-medium">{r.count}</span>
        </button>
      ))}
      {picking ? (
        <span className={`${chip} inline-flex items-center gap-[0.15em] border border-primary/40 bg-background animate-in fade-in zoom-in-95 duration-150`}>
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded px-[0.15em] leading-none transition-transform hover:scale-125"
              onClick={() => {
                onReact?.(e);
                setPicking(false);
              }}
              aria-label={`React ${e}`}
            >
              {e}
            </button>
          ))}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onReact && setPicking(true)}
          className={`${chip} inline-flex items-center border border-dashed border-foreground/25 text-muted-foreground ${onReact ? "hover:border-primary/60 hover:text-foreground" : "cursor-default"}`}
          aria-label="Add a reaction"
          title={onReact ? "React" : "React on the Play page"}
        >
          ＋☺
        </button>
      )}
    </div>
  );
}
