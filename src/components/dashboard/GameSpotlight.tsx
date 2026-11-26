import { useEffect, useState } from "react";
import { WORLD_LAND_PATH } from "./worldLand";
import { PlayQr } from "./JoinCard";

/* ── Wordle demo ──────────────────────────────────────────────────────────
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

/* ── Shared pieces ───────────────────────────────────────────────────────── */

/** Milliseconds since the demo mounted, ticking ~12 times a second. */
function useElapsed() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setT(Date.now() - start), 80);
    return () => clearInterval(id);
  }, []);
  return t;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - (1 - clamp01(x)) ** 3;

function YourTurn({ line }: { line: string }) {
  return (
    <div className="mt-[clamp(4px,0.4vw,8px)] flex items-center gap-[clamp(8px,0.7vw,14px)]">
      <div className="rounded-[clamp(4px,0.3vw,6px)] bg-white p-[3px] ring-2 ring-primary">
        <PlayQr className="h-[clamp(48px,4vw,84px)] w-[clamp(48px,4vw,84px)]" />
      </div>
      <p className="leading-tight text-[clamp(14px,1vw,21px)]">
        <span className="font-semibold">Your turn.</span>
        <br />
        <span className="text-muted-foreground">{line}</span>
      </p>
    </div>
  );
}

/** Same frame for every game: the animated board on the left, how to play on the right. */
function DemoLayout({
  board,
  title,
  body,
  points,
  cta,
}: {
  board: React.ReactNode;
  title: string;
  body: string;
  points?: string[];
  cta: string;
}) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-[clamp(20px,2.4vw,56px)]">
      <div className="flex h-full min-h-0 items-center justify-center">{board}</div>
      <div className="min-w-0 flex flex-col gap-[clamp(10px,1vw,20px)]">
        <div>
          <p className="tile-label">How to play</p>
          <h3 className="mt-[clamp(4px,0.4vw,8px)] font-semibold tracking-tight leading-[1.05] text-[clamp(24px,2.2vw,48px)]">{title}</h3>
        </div>
        <p className="text-muted-foreground leading-snug text-[clamp(14px,1.05vw,22px)] max-w-[36ch]">{body}</p>
        {points && (
          <ul className="flex flex-col gap-[clamp(4px,0.4vw,8px)] text-[clamp(13px,0.95vw,20px)]">
            {points.map((pt) => (
              <li key={pt} className="flex gap-2">
                <span className="text-primary">•</span>
                {pt}
              </li>
            ))}
          </ul>
        )}
        <YourTurn line={cta} />
      </div>
    </div>
  );
}

function Pin({ x, y, tone, show }: { x: number; y: number; tone: "guess" | "answer"; show: boolean }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, opacity: show ? 1 : 0, transition: "opacity 300ms" }}>
      <g className={show ? "pin-drop" : ""}>
        <circle r={tone === "answer" ? 5.5 : 5} fill={tone === "answer" ? "#16a34a" : "hsl(var(--primary))"} stroke="white" strokeWidth={2} />
      </g>
    </g>
  );
}

/** A stand-in "street photo" so the demo never shows a real round's location. */
function DemoPhoto({ hue }: { hue: number }) {
  return (
    <svg viewBox="0 0 160 110" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sky${hue}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 60% 78%)`} />
          <stop offset="1" stopColor={`hsl(${hue + 20} 50% 92%)`} />
        </linearGradient>
      </defs>
      <rect width="160" height="110" fill={`url(#sky${hue})`} />
      <rect x="6" y="38" width="30" height="52" fill="#d9c7b0" />
      <rect x="36" y="26" width="26" height="64" fill="#c9a98a" />
      <rect x="98" y="30" width="28" height="60" fill="#e3d3bd" />
      <rect x="126" y="44" width="30" height="46" fill="#b98f6e" />
      {[44, 58, 72].map((y) => [10, 20, 40, 50, 102, 114, 130, 142].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="7" fill="#7b6a5a" opacity=".55" />))}
      <path d="M0 90 H160 V110 H0Z" fill="#8a8a86" />
      <path d="M62 110 L74 90 H86 L98 110Z" fill="#a3a39f" />
      <circle cx="80" cy="64" r="16" fill="#5f8f4e" />
      <rect x="78" y="74" width="4" height="16" fill="#6b4f3a" />
    </svg>
  );
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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

/* ── GeoGuessr ───────────────────────────────────────────────────────────── */

const GEO_GUESS: [number, number] = [2.17, 41.39]; // lon, lat
const GEO_ANSWER: [number, number] = [4.84, 45.76];
const GEO_KM = Math.round(haversineKm(GEO_GUESS, GEO_ANSWER));

function GeoDemo() {
  const t = useElapsed();
  const zoomed = t > 1400;
  // Zoom from the world to Europe
  const S = 4.2;
  const CX = 192;
  const CY = 44;
  const toScreen = ([lon, lat]: [number, number]) => [180 + S * (lon + 180 - CX), 78 + S * (90 - lat - CY)];
  const [gx, gy] = toScreen(GEO_GUESS);
  const [ax, ay] = toScreen(GEO_ANSWER);
  const lineP = ease((t - 3600) / 700);
  const km = Math.round(GEO_KM * ease((t - 4000) / 900));

  return (
    <div className="grid h-full w-full grid-rows-[minmax(0,1fr)] grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-[clamp(8px,0.7vw,14px)]">
      <div className="relative overflow-hidden rounded-[clamp(8px,0.7vw,14px)]">
        <DemoPhoto hue={205} />
        <span className="absolute left-2 top-2 rounded-full bg-background px-2 py-0.5 text-[clamp(11px,0.75vw,15px)] font-semibold">Where is this?</span>
      </div>
      <div className="relative overflow-hidden rounded-[clamp(8px,0.7vw,14px)] bg-[hsl(205_45%_90%)]">
        <svg viewBox="0 8 360 140" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <g
            style={{
              transform: zoomed ? `translate(180px,78px) scale(${S}) translate(${-CX}px,${-CY}px)` : "none",
              transition: "transform 1200ms cubic-bezier(.2,.8,.2,1)",
            }}
          >
            <path d={WORLD_LAND_PATH} fill="hsl(36 25% 84%)" stroke="hsl(36 15% 70%)" strokeWidth={0.3} />
          </g>
          {lineP > 0 && (
            <line x1={gx} y1={gy} x2={gx + (ax - gx) * lineP} y2={gy + (ay - gy) * lineP} stroke="hsl(var(--foreground))" strokeWidth={1.5} strokeDasharray="4 3" />
          )}
          <Pin x={gx} y={gy} tone="guess" show={t > 2600} />
          <Pin x={ax} y={ay} tone="answer" show={t > 3600} />
        </svg>
        {t > 4000 && (
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background px-3 py-1 font-semibold tabular-nums text-[clamp(13px,1vw,20px)] animate-in fade-in">
            {km} km away
          </span>
        )}
      </div>
    </div>
  );
}

/* ── City Guess ──────────────────────────────────────────────────────────── */

const CITY_ROADS = [
  "M0 30 H200", "M0 70 H200", "M0 112 H200", "M30 0 V140", "M78 0 V140", "M128 0 V140", "M170 0 V140",
  "M0 140 L90 0", "M110 140 L200 40",
];

function CityDemo() {
  const t = useElapsed();
  const tries = [
    { at: 1800, x: 50, y: 40, m: 1240 },
    { at: 5200, x: 140, y: 88, m: 140 },
  ];
  const answer = { x: 150, y: 96 };
  const current = t > 5200 ? 1 : t > 1800 ? 0 : -1;
  const showAnswer = t > 6600;
  const p = ease((t - 6600) / 600);
  const last = tries[1];

  return (
    <div className="grid h-full w-full grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-[clamp(8px,0.7vw,14px)]">
      <div className="relative overflow-hidden rounded-[clamp(8px,0.7vw,14px)]">
        <DemoPhoto hue={30} />
        <span className="absolute left-2 top-2 rounded-full bg-background px-2 py-0.5 text-[clamp(11px,0.75vw,15px)] font-semibold">Stockholm</span>
      </div>
      <div className="relative overflow-hidden rounded-[clamp(8px,0.7vw,14px)] bg-[hsl(40_30%_94%)]">
        <svg viewBox="0 0 200 140" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <path d="M0 0 H200 V18 C150 26 120 10 60 22 S0 16 0 16Z" fill="hsl(205 45% 85%)" />
          <rect x="84" y="78" width="38" height="28" rx="3" fill="hsl(110 30% 82%)" />
          {CITY_ROADS.map((d) => (
            <path key={d} d={d} stroke="white" strokeWidth={5} fill="none" />
          ))}
          {CITY_ROADS.map((d) => (
            <path key={`${d}-c`} d={d} stroke="hsl(36 15% 80%)" strokeWidth={0.6} fill="none" />
          ))}
          {showAnswer && (
            <line x1={last.x} y1={last.y} x2={last.x + (answer.x - last.x) * p} y2={last.y + (answer.y - last.y) * p} stroke="hsl(var(--foreground))" strokeWidth={1.2} strokeDasharray="3 2.5" />
          )}
          {tries.map((g, i) => (
            <Pin key={i} x={g.x} y={g.y} tone="guess" show={t > g.at && (i === current || i < current)} />
          ))}
          <Pin x={answer.x} y={answer.y} tone="answer" show={showAnswer} />
        </svg>
        {current >= 0 && (
          <span
            key={current}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-background px-3 py-1 font-semibold tabular-nums text-[clamp(13px,1vw,20px)] animate-in fade-in"
          >
            Try {current + 1}: {tries[current].m >= 1000 ? `${(tries[current].m / 1000).toFixed(1)} km` : `${tries[current].m} m`} away
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Color Memory ────────────────────────────────────────────────────────── */

const COLOR_TARGET = { h: 16, s: 82, l: 60 };
const COLOR_START = { h: 200, s: 40, l: 45 };

function ColorDemo() {
  const t = useElapsed();
  const memorize = t < 3600;
  const k = (start: number) => ease((t - start) / 1300);
  const guess = {
    h: Math.round(COLOR_START.h + (COLOR_TARGET.h + 6 - COLOR_START.h) * k(4200)),
    s: Math.round(COLOR_START.s + (COLOR_TARGET.s - 4 - COLOR_START.s) * k(5300)),
    l: Math.round(COLOR_START.l + (COLOR_TARGET.l + 3 - COLOR_START.l) * k(6400)),
  };
  const done = t > 8200;
  const hsl = (c: { h: number; s: number; l: number }) => `hsl(${c.h} ${c.s}% ${c.l}%)`;
  const sliders: { label: string; value: number; max: number; track: string }[] = [
    { label: "Hue", value: guess.h, max: 360, track: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" },
    { label: "Saturation", value: guess.s, max: 100, track: `linear-gradient(90deg,hsl(${guess.h} 0% ${guess.l}%),hsl(${guess.h} 100% ${guess.l}%))` },
    { label: "Lightness", value: guess.l, max: 100, track: `linear-gradient(90deg,#000,hsl(${guess.h} ${guess.s}% 50%),#fff)` },
  ];

  return (
    <div className="flex h-full w-full flex-col justify-center gap-[clamp(8px,0.8vw,16px)]">
      <div className="flex gap-[clamp(8px,0.7vw,14px)] h-[45%] min-h-0">
        <div
          className="relative flex-1 rounded-[clamp(8px,0.7vw,14px)] transition-colors duration-500"
          style={{ background: memorize || done ? hsl(COLOR_TARGET) : "hsl(var(--secondary))" }}
        >
          <span className="absolute left-2 top-2 rounded-full bg-background px-2 py-0.5 text-[clamp(11px,0.75vw,15px)] font-semibold">
            {memorize ? "Memorize" : done ? "Target" : "?"}
          </span>
          {memorize && (
            <div className="absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-white/50 overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${(1 - t / 3600) * 100}%` }} />
            </div>
          )}
        </div>
        {!memorize && (
          <div className="relative flex-1 rounded-[clamp(8px,0.7vw,14px)] animate-in fade-in" style={{ background: hsl(guess) }}>
            <span className="absolute left-2 top-2 rounded-full bg-background px-2 py-0.5 text-[clamp(11px,0.75vw,15px)] font-semibold">
              {done ? "93% match" : "Yours"}
            </span>
          </div>
        )}
      </div>
      <div className={`flex flex-col gap-[clamp(6px,0.6vw,12px)] transition-opacity duration-500 ${memorize ? "opacity-30" : ""}`}>
        {sliders.map((sl) => (
          <div key={sl.label} className="flex items-center gap-2">
            <span className="w-[7em] shrink-0 text-[clamp(11px,0.8vw,16px)] text-muted-foreground">{sl.label}</span>
            <div className="relative h-[clamp(8px,0.6vw,12px)] flex-1 rounded-full" style={{ background: sl.track }}>
              <span
                className="absolute top-1/2 h-[clamp(16px,1.2vw,24px)] w-[clamp(16px,1.2vw,24px)] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
                style={{ left: `${(sl.value / sl.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── This or That ────────────────────────────────────────────────────────── */

const TOT_QUESTIONS = [
  { prompt: "Which is bigger?", a: "The Moon", b: "Pluto", correct: "a" as const, at: 0 },
  { prompt: "Which launched first?", a: "Spotify", b: "Instagram", correct: "a" as const, at: 5000 },
];

function ThisOrThatDemo() {
  const t = useElapsed();
  const qi = t >= TOT_QUESTIONS[1].at ? 1 : 0;
  const q = TOT_QUESTIONS[qi];
  const local = t - q.at;
  const picked = local > 2000;
  const revealed = local > 2700;

  return (
    <div key={qi} className="flex h-full w-full flex-col justify-center gap-[clamp(10px,1vw,20px)] animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold tracking-tight text-[clamp(20px,1.8vw,38px)] leading-tight">{q.prompt}</p>
        <span className="tile-label tabular-nums">{qi + 1} / 5</span>
      </div>
      <div className="grid grid-cols-2 gap-[clamp(8px,0.8vw,16px)] h-[50%] min-h-0">
        {(["a", "b"] as const).map((side) => {
          const isPick = picked && side === q.correct;
          const right = revealed && side === q.correct;
          return (
            <div
              key={side}
              className={`flex items-center justify-center rounded-[clamp(10px,0.9vw,18px)] border-2 text-center font-semibold text-[clamp(16px,1.4vw,30px)] transition-all duration-300 ${
                right
                  ? "border-green-600 bg-green-600 text-white"
                  : isPick
                    ? "scale-[0.97] border-primary bg-primary/15"
                    : revealed
                      ? "border-transparent bg-secondary text-muted-foreground"
                      : "border-transparent bg-secondary"
              }`}
            >
              {side === "a" ? q.a : q.b}
              {right && " ✓"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sudoku (6×6) ────────────────────────────────────────────────────────── */

const SUDOKU = [
  [1, 2, 3, 4, 5, 6],
  [4, 5, 6, 1, 2, 3],
  [2, 3, 1, 5, 6, 4],
  [5, 6, 4, 2, 3, 1],
  [3, 1, 2, 6, 4, 5],
  [6, 4, 5, 3, 1, 2],
];
// Cells the demo fills in, in order (row, col). The rest start as givens or stay empty.
const SUDOKU_FILLS: [number, number][] = [[2, 0], [2, 2], [3, 1], [3, 0], [2, 1], [3, 2], [0, 4], [1, 3]];
const SUDOKU_EMPTY = new Set(["0,1", "1,5", "4,3", "5,0", "4,4", "0,4", "1,3", ...SUDOKU_FILLS.map(([r, c]) => `${r},${c}`)]);

function SudokuDemo() {
  const t = useElapsed();
  const filled = Math.max(0, Math.min(SUDOKU_FILLS.length, Math.floor((t - 900) / 750) + 1));
  const active = SUDOKU_FILLS[Math.min(filled, SUDOKU_FILLS.length - 1)];
  const doneFill = new Set(SUDOKU_FILLS.slice(0, filled).map(([r, c]) => `${r},${c}`));
  const boxDone = filled >= 6; // the middle-left box (rows 2-3, cols 0-2) is complete after 6 fills

  return (
    <div className="aspect-square h-full max-h-full grid grid-cols-6 grid-rows-6 overflow-hidden rounded-[clamp(8px,0.7vw,14px)] border-2 border-foreground/70 bg-[hsl(var(--card))]">
      {SUDOKU.map((row, r) =>
        row.map((n, c) => {
          const key = `${r},${c}`;
          const isEmpty = SUDOKU_EMPTY.has(key);
          const isFilled = doneFill.has(key);
          const isActive = filled < SUDOKU_FILLS.length && active[0] === r && active[1] === c;
          const inBox = boxDone && r >= 2 && r <= 3 && c <= 2;
          return (
            <div
              key={key}
              className={`flex items-center justify-center tabular-nums text-[clamp(14px,1.3vw,28px)] transition-colors duration-300
                ${c % 3 === 2 && c < 5 ? "border-r-2 border-r-foreground/70" : "border-r border-r-foreground/15"}
                ${r % 2 === 1 && r < 5 ? "border-b-2 border-b-foreground/70" : "border-b border-b-foreground/15"}
                ${isActive ? "bg-primary/20" : inBox ? "bg-green-600/15" : ""}`}
            >
              {!isEmpty ? (
                <span className="font-semibold">{n}</span>
              ) : isFilled ? (
                <span className="tile-pop font-medium text-primary">{n}</span>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ── Pairs ───────────────────────────────────────────────────────────────── */

const PAIRS_TILES = ["🌸", "🚀", "🍕", "🌙", "🔥", "🍀", "🎵", "⭐", "🌊", "🎨", "🍕", "🌸", "🎨", "🍀", "⭐", "🌙", "🎵", "🌊", "🔥", "🚀"];
const PAIRS_SCRIPT: [number, number][] = [[0, 9], [3, 15], [1, 4], [1, 19], [2, 10], [6, 7], [7, 14]];
const PAIRS_STEP = 1350;

function PairsDemo() {
  const t = useElapsed();
  const step = Math.floor((t - 600) / PAIRS_STEP);
  const within = (t - 600) % PAIRS_STEP;
  const matched = new Set<number>();
  for (let i = 0; i < Math.min(step, PAIRS_SCRIPT.length); i++) {
    const [a, b] = PAIRS_SCRIPT[i];
    if (PAIRS_TILES[a] === PAIRS_TILES[b]) {
      matched.add(a);
      matched.add(b);
    }
  }
  const open = new Set<number>();
  if (step >= 0 && step < PAIRS_SCRIPT.length) {
    const [a, b] = PAIRS_SCRIPT[step];
    if (within > 0) open.add(a);
    if (within > 450) open.add(b);
  }
  const moves = Math.max(0, Math.min(step + (within > 450 ? 1 : 0), PAIRS_SCRIPT.length));

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[clamp(6px,0.6vw,12px)]">
      <div className="grid h-[82%] aspect-[5/4] grid-cols-5 grid-rows-4 gap-[clamp(5px,0.45vw,9px)]">
        {PAIRS_TILES.map((emoji, i) => {
          const face = matched.has(i) || open.has(i);
          return (
            <div
              key={`${i}-${face}`}
              className={`flex min-h-0 items-center justify-center rounded-[clamp(6px,0.5vw,10px)] text-[clamp(16px,1.5vw,32px)] ${
                face ? (matched.has(i) ? "bg-green-600/15 ring-2 ring-green-600/60 tile-flip" : "bg-[hsl(var(--card))] ring-2 ring-primary tile-flip") : "bg-foreground/80"
              }`}
            >
              {face ? emoji : ""}
            </div>
          );
        })}
      </div>
      <div className="flex w-full max-w-[90%] justify-between text-[clamp(12px,0.85vw,18px)] text-muted-foreground tabular-nums">
        <span>Moves {moves}</span>
        <span>{matched.size / 2} / 10 pairs</span>
      </div>
    </div>
  );
}

/* ── Zip (labyrinth) ───────────────────────────────────────────────────────── */

const ZIP_PATH: [number, number][] = [
  [0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [3, 1], [2, 1], [2, 2], [1, 2], [0, 2],
  [0, 3], [0, 4], [1, 4], [1, 3], [2, 3], [2, 4], [3, 4], [4, 4], [4, 3], [3, 3], [3, 2], [4, 2],
];
const ZIP_CHECKPOINTS: Record<number, number> = { 0: 1, 6: 2, 12: 3, 15: 4, 20: 5, 24: 6 };

function ZipDemo() {
  const t = useElapsed();
  const steps = Math.max(1, Math.min(ZIP_PATH.length, Math.floor((t - 700) / 300) + 1));
  const cell = 20;
  const pts = ZIP_PATH.slice(0, steps).map(([r, c]) => `${c * cell + cell / 2},${r * cell + cell / 2}`).join(" ");
  const visited = new Set(ZIP_PATH.slice(0, steps).map(([r, c]) => `${r},${c}`));
  const complete = steps === ZIP_PATH.length;

  return (
    <svg viewBox="-2 -2 104 104" className="aspect-square h-full max-h-full">
      {Array.from({ length: 25 }).map((_, i) => {
        const r = Math.floor(i / 5);
        const c = i % 5;
        return (
          <rect
            key={i}
            x={c * cell + 1}
            y={r * cell + 1}
            width={cell - 2}
            height={cell - 2}
            rx={3}
            fill={visited.has(`${r},${c}`) ? (complete ? "rgb(22 163 74 / .18)" : "hsl(var(--primary) / .16)") : "hsl(var(--secondary))"}
            style={{ transition: "fill 250ms" }}
          />
        );
      })}
      <polyline points={pts} fill="none" stroke={complete ? "#16a34a" : "hsl(var(--primary))"} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      {Object.entries(ZIP_CHECKPOINTS).map(([idx, n]) => {
        const [r, c] = ZIP_PATH[Number(idx)];
        return (
          <g key={idx}>
            <circle cx={c * cell + cell / 2} cy={r * cell + cell / 2} r={6.5} fill="hsl(var(--foreground))" />
            <text x={c * cell + cell / 2} y={r * cell + cell / 2 + 2.6} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="white">
              {n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Games that have a demo, keyed like the leaderboard. Each runs about 11 seconds. */
export const GAME_DEMOS: Record<string, { Demo: () => JSX.Element; durationMs: number }> = {
  wordle: { Demo: WordleDemo, durationMs: WORDLE_DEMO_MS },
  geo: {
    Demo: () => (
      <DemoLayout
        board={<GeoDemo />}
        title="GeoGuessr"
        body="A new street photo every day. Drop a pin where you think it was taken. The closer you get, the more points."
        points={["Easy and hard photo each day", "Distance decides your score"]}
        cta="Today’s photos are up"
      />
    ),
    durationMs: 10_500,
  },
  city_guess: {
    Demo: () => (
      <DemoLayout
        board={<CityDemo />}
        title="City Guess"
        body="Pick New York, Varna or Stockholm, then find where the street photo was taken on the city map."
        points={["Several tries per photo", "Fewer tries, more points"]}
        cta="Which city do you know best?"
      />
    ),
    durationMs: 10_500,
  },
  color_memory: {
    Demo: () => (
      <DemoLayout
        board={<ColorDemo />}
        title="Color Memory"
        body="You see a colour for 5 seconds. Then rebuild it from memory with hue, saturation and lightness."
        points={["The closer the match, the higher the score"]}
        cta="How good is your colour eye?"
      />
    ),
    durationMs: 11_000,
  },
  this_or_that: {
    Demo: () => (
      <DemoLayout
        board={<ThisOrThatDemo />}
        title="This or That"
        body="Five quick questions a day, two answers each. Tap the one you think is right."
        points={["Points for every right answer", "New questions daily"]}
        cta="Five taps, about a minute"
      />
    ),
    durationMs: 10_500,
  },
  sudoku: {
    Demo: () => (
      <DemoLayout
        board={<SudokuDemo />}
        title="Sudoku 6×6"
        body="Fill the grid so every row, column and 2×3 box has the numbers 1 to 6."
        points={["Faster solve, more points", "Hints cost points"]}
        cta="A new grid every day"
      />
    ),
    durationMs: 9_500,
  },
  pairs: {
    Demo: () => (
      <DemoLayout
        board={<PairsDemo />}
        title="Pairs"
        body="Flip two cards at a time and find all 10 matching pairs."
        points={["Fewer moves and less time, more points"]}
        cta="Test your memory"
      />
    ),
    durationMs: 11_000,
  },
  labyrinth: {
    Demo: () => (
      <DemoLayout
        board={<ZipDemo />}
        title="Zip"
        body="Draw one line through every cell, passing the numbers in order. No crossing, no skipping."
        points={["Fill the whole grid to finish", "Faster, more points"]}
        cta="One line, every cell"
      />
    ),
    durationMs: 10_000,
  },
};

/* ── Spotlight scheduler ──────────────────────────────────────────────────────────────── */

const FIRST_AFTER_MS = 60_000;
const EVERY_MS = 4 * 60_000;
const HIGHLIGHT_MS = 2_500;

export type SpotlightState = { gameKey: string; phase: "highlight" | "demo" } | null;

/**
 * Every few minutes: highlight one game's leaderboard, then play its demo, then go away.
 * Open the TV with ?demo in the address (e.g. /?demo#/tv) to see it within seconds,
 * or ?demo=sudoku for one game.
 */
export function useGameSpotlight(): SpotlightState {
  const [state, setState] = useState<SpotlightState>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preview = params.has("demo");
    const only = params.get("demo");
    // Order matches the leaderboard so the highlight moves around the board.
    // ?demo=pairs (or any game key) previews just that one game.
    const keys =
      only && only in GAME_DEMOS
        ? [only]
        : ["wordle", "geo", "city_guess", "color_memory", "this_or_that", "sudoku", "pairs", "labyrinth"].filter((k) => k in GAME_DEMOS);
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
