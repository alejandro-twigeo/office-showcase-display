import { useState } from "react";
import { REACTION_EMOJIS } from "@/hooks/useKudosReactions";

interface Props {
  reactions: { emoji: string; count: number; names: string[]; mine: boolean }[];
  /** Called with an emoji to react (or take it back). Leave out where nobody can react. */
  onReact?: (emoji: string) => void;
  /** Size: the TV scales with the screen, the phone uses fixed sizes */
  size?: "tv" | "phone";
}

const USAGE_KEY = "reaction-usage";

/** Your most used reactions first (remembered on this device), then the usual six */
function quickEmojis(): string[] {
  let usage: Record<string, number> = {};
  try {
    usage = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
  } catch {
    /* ignore */
  }
  const mine = Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .map(([e]) => e);
  return [...new Set([...mine, ...REACTION_EMOJIS])].slice(0, 6);
}

function remember(emoji: string) {
  try {
    const usage = JSON.parse(localStorage.getItem(USAGE_KEY) || "{}");
    usage[emoji] = (usage[emoji] ?? 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    /* ignore */
  }
}

/** The first emoji in what someone typed or pasted, or null if there isn't one */
function firstEmoji(text: string): string | null {
  // Split into whole characters, so emojis like 👍🏽 stay in one piece
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Segmenter = (Intl as any).Segmenter;
  const seg: string[] = Segmenter ? [...new Segmenter().segment(text.trim())].map((s: { segment: string }) => s.segment) : [...text.trim()];
  const e = seg.find((s) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s));
  return e ?? null;
}

/**
 * Reactions under a kudos: each emoji with its count, plus a small "＋☺" button so people know
 * they can react. Tapping it opens your most used emojis, and "…" lets you type any other.
 * Tapping one of yours takes it back.
 */
export function ReactionBar({ reactions, onReact, size = "phone" }: Props) {
  const [picking, setPicking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const tv = size === "tv";
  const chip = tv ? "rounded-full px-[0.6em] py-[0.15em] text-[clamp(12px,0.85vw,18px)]" : "rounded-full px-2 py-0.5 text-xs";

  const react = (e: string) => {
    remember(e);
    onReact?.(e);
    setPicking(false);
    setTyping(false);
    setTyped("");
  };

  return (
    <div className="flex flex-wrap items-center gap-[0.35em]" onClick={(e) => e.stopPropagation()}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          title={r.names.join(", ")}
          disabled={!onReact}
          onClick={() => onReact && react(r.emoji)}
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
          {quickEmojis().map((e) => (
            <button
              key={e}
              type="button"
              className="rounded px-[0.15em] leading-none transition-transform hover:scale-125"
              onClick={() => react(e)}
              aria-label={`React ${e}`}
            >
              {e}
            </button>
          ))}
          {typing ? (
            <input
              autoFocus
              value={typed}
              onChange={(ev) => {
                const e = firstEmoji(ev.target.value);
                if (e) react(e);
                else setTyped(ev.target.value.slice(-4));
              }}
              onKeyDown={(ev) => ev.key === "Escape" && setPicking(false)}
              placeholder="any 😀"
              aria-label="Type any emoji"
              className="w-[4.5em] rounded border border-border bg-background px-1 text-[0.9em] outline-none focus:border-primary"
            />
          ) : (
            <button
              type="button"
              onClick={() => setTyping(true)}
              className="rounded px-[0.3em] font-semibold leading-none text-muted-foreground hover:text-foreground"
              aria-label="Another emoji"
              title="Another emoji"
            >
              …
            </button>
          )}
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
