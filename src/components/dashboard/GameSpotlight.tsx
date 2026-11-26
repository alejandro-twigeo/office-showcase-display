import { useEffect, useState } from "react";
import { PlayQr } from "./JoinCard";

/* ── Wordle demo ─────────────────────────────────────────────────────────────────────────
   Plays a fake game on the TV so people can see how Wordle works.
   The demo words are deliberately NOT in the real word list, so the demo
   can never spoil a real day's answer.                                   */

const DEMO_ANSWER = "PIXEL";
const DEMO_GUESSES = ["STONE", "LIVED", "PIXEL"];

type Mark = "correct" | "present" | "absent";

function score(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(5).fill("absent");
  const left = answer.split("");
  guess.split("").forEach((ch, i) => {
    if (answer[i] === ch) {
      marks[i] = "correct";
      left[i] = "";
    }
  });
  guess.split("").forEach((ch, i) => {
    if (marks[i] === "correct") return;
    const j = left.indexOf(ch);
    if (j !== -1) {
      marks[i] = "present";
      left[j] = "";
    }
  });
  return marks;
}

const MARK_CLASS: Record<Mark, string> = {
  correct: "bg-green-600 border-green-600 text-white",
  present: "bg-yellow-500 border-yellow-500 text-white",
  absent: "bg-muted-foreground/30 border-transparent text-foreground",
};

const TYPE_MS = 130;
const FLIP_STAGGER_MS = 200;

/** Timeline: type a guess, flip it, pause, next guess. Ends on "Solved in 3". */
function useWordleTimeline() {
  const [typed, setTyped] = useState<string[]>(["", "", "", "", "", ""]);
  const [revealed, setRevealed] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let t = 700;
    DEMO_GUESSES.forEach((word, row) => {
      for (let i = 1; i <= 5; i++) {
        const text = word.slice(0, i);
        timers.push(setTimeout(() => setTyped((p) => p.map((v, r) => (r === row ? text : v))), t));
        t += TYPE_MS;
      }
      t += 350;
      for (let i = 1; i <= 5; i++) {
        const n = i;
        timers.push(setTimeout(() => setRevealed((p) => p.map((v, r) => (r === row ? n : v))), t));
        t += FLIP_STAGGER_MS;
      }
      t += 1100;
    });
    timers.push(setTimeout(() => setSolved(true), t - 600));
    return () => timers.forEach(clearTimeout);
  }, []);

  return { typed, revealed, solved };
}

export const WORDLE_DEMO_MS = 13_000;

function WordleDemo() {
  const { typed, revealed, solved } = useWordleTimeline();

  return (
    <div className="grid h-full min-h-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-[clamp(20px,2.4vw,56px)]">
      {/* Board */}
      <div className="grid grid-rows-6 gap-[clamp(4px,0.35vw,7px)]" style={{ perspective: 600 }}>
        {typed.map((word, row) => {
          const marks = row < DEMO_GUESSES.length ? score(DEMO_GUESSES[row], DEMO_ANSWER) : [];
          return (
            <div key={row} className="grid grid-cols-5 gap-[clamp(4px,0.35vw,7px)]">
              {Array.from({ length: 5 }).map((_, col) => {
                const ch = word[col] ?? "";
                const isRevealed = col < revealed[row];
                return (
                  <div
                    key={`${col}-${isRevealed}`}
                    className={`flex items-center justify-center rounded-[clamp(4px,0.35vw,8px)] border-2 font-bold uppercase
                      h-[clamp(30px,2.6vw,56px)] w-[clamp(30px,2.6vw,56px)] text-[clamp(15px,1.4vw,30px)]
                      ${isRevealed ? `${MARK_CLASS[marks[col]]} tile-flip` : ch ? "border-foreground/45 bg-[hsl(var(--card))] tile-pop" : "border-foreground/15 bg-[hsl(var(--card))]"}`}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* How to play */}
      <div className="min-w-0 flex flex-col gap-[clamp(10px,1vw,20px)]">
        <div>
          <p className="tile-label">How to play</p>
          <h3 className="mt-[clamp(4px,0.4vw,8px)] font-semibold tracking-tight leading-[1.05] text-[clamp(24px,2.2vw,48px)]">
            {solved ? "Solved in 3." : "Wordle"}
          </h3>
        </div>
        <p className="text-muted-foreground leading-snug text-[clamp(14px,1.05vw,22px)] max-w-[34ch]">
          Guess the 5-letter word in 6 tries. Each guess shows how close you are.
        </p>
        <ul className="flex flex-col gap-[clamp(6px,0.5vw,10px)] text-[clamp(13px,0.95vw,20px)]">
          <li className="flex items-center gap-2">
            <span className="h-[1.1em] w-[1.1em] shrink-0 rounded-[3px] bg-green-600" /> Right letter, right spot
          </li>
          <li className="flex items-center gap-2">
            <span className="h-[1.1em] w-[1.1em] shrink-0 rounded-[3px] bg-yellow-500" /> Right letter, wrong spot
          </li>
          <li className="flex items-center gap-2">
            <span className="h-[1.1em] w-[1.1em] shrink-0 rounded-[3px] bg-muted-foreground/30" /> Not in the word
          </li>
        </ul>
        <div className="mt-[clamp(4px,0.4vw,8px)] flex items-center gap-[clamp(8px,0.7vw,14px)]">
          <div className="rounded-[clamp(4px,0.3vw,6px)] bg-white p-[3px] ring-2 ring-primary">
            <PlayQr className="h-[clamp(48px,4vw,84px)] w-[clamp(48px,4vw,84px)]" />
          </div>
          <p className="leading-tight text-[clamp(14px,1vw,21px)]">
            <span className="font-semibold">Your turn.</span>
            <br />
            <span className="text-muted-foreground">Today&rsquo;s word is waiting</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Games that have a demo. Add more here (gameKey → component + duration). */
export const GAME_DEMOS: Record<string, { Demo: () => JSX.Element; durationMs: number }> = {
  wordle: { Demo: WordleDemo, durationMs: WORDLE_DEMO_MS },
};

/* ── Spotlight scheduler ──────────────────────────────────────────────────────────────────── */

const FIRST_AFTER_MS = 60_000;
const EVERY_MS = 4 * 60_000;
const HIGHLIGHT_MS = 2_500;

export type SpotlightState = { gameKey: string; phase: "highlight" | "demo" } | null;

/**
 * Every few minutes: highlight one game's leaderboard, then play its demo, then go away.
 * Open the TV with ?demo in the address (e.g. /?demo#/tv) to see it within seconds.
 */
export function useGameSpotlight(): SpotlightState {
  const [state, setState] = useState<SpotlightState>(null);

  useEffect(() => {
    const preview = new URLSearchParams(window.location.search).has("demo");
    const keys = Object.keys(GAME_DEMOS);
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const run = () => {
      const gameKey = keys[i++ % keys.length];
      setState({ gameKey, phase: "highlight" });
      timers.push(setTimeout(() => setState({ gameKey, phase: "demo" }), HIGHLIGHT_MS));
      timers.push(setTimeout(() => setState(null), HIGHLIGHT_MS + GAME_DEMOS[gameKey].durationMs));
    };

    const first = setTimeout(run, preview ? 1_500 : FIRST_AFTER_MS);
    const every = setInterval(run, preview ? 25_000 : EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      timers.forEach(clearTimeout);
    };
  }, []);

  return state;
}

export function GameDemoOverlay({ gameKey }: { gameKey: string }) {
  const entry = GAME_DEMOS[gameKey];
  if (!entry) return null;
  const { Demo } = entry;
  return (
    <div className="absolute inset-[clamp(8px,0.7vw,14px)] z-20 rounded-[clamp(12px,1vw,20px)] bg-[hsl(var(--card))] p-[clamp(16px,1.6vw,36px)] shadow-[0_12px_40px_-12px_hsl(var(--foreground)/0.25)] animate-in fade-in zoom-in-95 duration-300">
      <Demo />
    </div>
  );
}
