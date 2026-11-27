import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { useOfficeActivity, GAME_NAMES, type PlayEvent } from "@/hooks/useOfficeActivity";
import { useSpotlight } from "./GameSpotlight";
import { CountUp } from "@/components/ui/count-up";
import { useFlip } from "@/hooks/useFlip";
import { PlayQr } from "./JoinCard";

const GAME_EMOJI: Record<string, string> = {
  wordle: "🟩",
  geo: "🌍",
  city_guess: "🏙️",
  color_memory: "🎨",
  this_or_that: "⚖️",
  sudoku: "🔢",
  pairs: "🃏",
  labyrinth: "🌀",
};
const ALL_GAMES = Object.keys(GAME_EMOJI);
const HOT_MS = 3 * 60_000;
// All eight games get a card (3 × 3 grid); the ninth slot holds a challenge, a streak or the QR
const SHOWN = 8;

/** 0–5 bars for how much has been played in the last hour */
function activityLevel(n: number) {
  return [1, 3, 6, 10, 15].filter((t) => n >= t).length;
}

export function ActivityMeter({ level, label }: { level: number; label?: string }) {
  return (
    <span className="flex items-center gap-[clamp(6px,0.5vw,10px)] text-muted-foreground text-[clamp(12px,0.8vw,16px)]">
      {label}
      <span className="flex items-end gap-[3px]">
        {[0, 1, 2, 3, 4].map((k) => (
          <i
            key={k}
            className={`block w-[clamp(5px,0.35vw,8px)] rounded-[3px] transition-colors duration-500 ${k < level ? "bg-primary" : "bg-secondary"}`}
            style={{ height: `calc(${0.5 + k * 0.2}em + 2px)` }}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * Top three of one game. Every row is the same element keyed by player, so when someone
 * overtakes, the rows slide into their new places and the score counts up.
 */
function Podium({ rows, av, badges }: { rows: PlayEvent[]; av: (n: string) => string; badges: (n: string) => JSX.Element | null }) {
  const ref = useFlip<HTMLDivElement>([rows.map((r) => r.player).join("|")]);
  return (
    // flex-wrap: a row that doesn't fit wraps out of view instead of showing half
    <div ref={ref} className="flex min-h-0 flex-1 flex-col flex-wrap content-start gap-[clamp(4px,0.35vw,8px)] overflow-hidden">
      {rows.map((e, i) =>
        i === 0 ? (
          <div
            key={e.player}
            data-flip={e.player}
            className="flex w-full items-center gap-[clamp(6px,0.5vw,10px)] rounded-[clamp(8px,0.6vw,12px)] bg-[hsl(var(--card))] px-[clamp(8px,0.6vw,12px)] py-[clamp(5px,0.4vw,9px)]"
          >
            <span className="leading-none text-[clamp(18px,1.4vw,30px)]">{av(e.player)}</span>
            <span className="flex min-w-0 flex-1 items-center gap-1 font-semibold text-[clamp(13px,1vw,21px)]">
              <span className="truncate">{e.player}</span>
              {badges(e.player)}
            </span>
            <CountUp value={e.score} className="shrink-0 font-semibold tabular-nums text-primary text-[clamp(15px,1.2vw,26px)]" />
          </div>
        ) : (
          <div
            key={e.player}
            data-flip={e.player}
            className="flex w-full items-center gap-[clamp(5px,0.4vw,8px)] px-[clamp(4px,0.3vw,6px)] py-[clamp(2px,0.25vw,5px)] text-[clamp(12px,0.85vw,18px)]"
          >
            <span className="w-[1.1em] text-center font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="leading-none">{av(e.player)}</span>
            <span className="flex min-w-0 flex-1 items-center gap-1">
              <span className="truncate">{e.player}</span>
              {badges(e.player)}
            </span>
            <CountUp value={e.score} className="tabular-nums" />
          </div>
        )
      )}
    </div>
  );
}

/**
 * The Play zone's main tile: today's most played games, each with its podium.
 * A game played in the last few minutes lights up with "+1" and who played it.
 */
export function GamesTile() {
  const a = useOfficeActivity();
  const spotlight = useSpotlight();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);

  const av = (n: string) => a.players.get(n)?.avatar ?? "👤";
  const todayCount = [...a.todayByGame.values()].reduce((s, l) => s + l.length, 0);
  const lastHour = a.events.filter((e) => e.day === a.today && now - Date.parse(e.at) < 3_600_000).length;

  const games = useMemo(() => {
    const played = ALL_GAMES.filter((g) => (a.todayByGame.get(g)?.length ?? 0) > 0).sort(
      (x, y) => (a.todayByGame.get(y)?.length ?? 0) - (a.todayByGame.get(x)?.length ?? 0)
    );
    const unplayed = ALL_GAMES.filter((g) => !played.includes(g));
    return { shown: [...played, ...unplayed].slice(0, SHOWN), rest: [...played, ...unplayed].slice(SHOWN) };
  }, [a.todayByGame]);

  const latest = (g: string): PlayEvent | undefined =>
    (a.todayByGame.get(g) ?? []).reduce<PlayEvent | undefined>((m, e) => (!m || e.at > m.at ? e : m), undefined);

  const badges = (name: string) =>
    a.lastWeekChampion === name ? <span className="shrink-0" title="Champion of last week">👑</span> : null;

  // Something worth a nudge in the ninth slot: a live challenge, else the longest streak
  const challenge = a.challenges.find((c) => c.status === "open");
  const topStreak = [...a.streaks.entries()].sort((x, y) => y[1] - x[1])[0];

  return (
    <Card className="h-full min-h-0 flex flex-col p-[clamp(14px,1.3vw,28px)] gap-[clamp(10px,0.8vw,16px)]">
      <div className="flex items-center justify-between gap-3">
        <span className="tile-label">
          Games · <CountUp value={todayCount} /> played today
        </span>
        <ActivityMeter level={activityLevel(lastHour)} label="Activity" />
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-3 grid-rows-3 gap-[clamp(8px,0.7vw,14px)]">
        {games.shown.map((g) => {
          const board = a.todayByGame.get(g) ?? [];
          const [lead, ...rest] = board;
          const last = latest(g);
          const hot = !!last && now - Date.parse(last.at) < HOT_MS;
          const lit = spotlight?.gameKey === g;
          return (
            <div
              key={g}
              className={`relative flex min-h-0 flex-col gap-[clamp(6px,0.5vw,10px)] rounded-[clamp(12px,1vw,20px)] p-[clamp(10px,0.8vw,16px)] transition-all duration-500 ${
                hot ? "bg-green-600/10 shadow-[0_0_0_2px_hsl(142_60%_45%/0.45)]" : lead ? "bg-background" : "border border-dashed border-foreground/15"
              } ${lit ? "shadow-[0_0_0_3px_hsl(var(--primary))] scale-[1.02]" : ""}`}
            >
              {hot && last && (
                <span className="absolute -top-[0.9em] right-[clamp(8px,0.7vw,14px)] z-10 rounded-full bg-[hsl(var(--card))] px-[0.8em] py-[0.25em] font-semibold shadow-[0_8px_24px_-10px_rgba(0,0,0,0.35)] text-[clamp(12px,0.85vw,18px)] animate-in fade-in zoom-in-90 duration-500">
                  +1 {av(last.player)} {last.player}
                </span>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <span className={`truncate font-semibold text-[clamp(14px,1.1vw,23px)] ${lead ? "" : "text-muted-foreground"}`}>
                  {GAME_EMOJI[g]} {GAME_NAMES[g] ?? g}
                </span>
                {board.length > 0 && <span className="shrink-0 text-muted-foreground tabular-nums text-[clamp(11px,0.75vw,16px)]">{board.length} today</span>}
              </div>
              {lead ? (
                <Podium rows={[lead, ...rest].slice(0, 3)} av={av} badges={badges} />
              ) : (
                <p className="m-auto text-center text-muted-foreground text-[clamp(12px,0.85vw,17px)]">
                  No scores yet.
                  <br />
                  <span className="font-medium text-foreground/70">Be the first</span>
                </p>
              )}
            </div>
          );
        })}
        {/* Ninth slot: something to nudge people with */}
        <div className="flex min-h-0 flex-col justify-center gap-[clamp(6px,0.5vw,10px)] rounded-[clamp(12px,1vw,20px)] bg-primary/[0.07] p-[clamp(10px,0.8vw,16px)] text-[clamp(13px,0.95vw,20px)] leading-snug">
          {challenge ? (
            <>
              <span className="tile-label">Challenge</span>
              <p>
                ⚔️ <b>{challenge.from}</b> challenged <b>{challenge.to}</b> in {GAME_NAMES[challenge.game] ?? challenge.game}
              </p>
            </>
          ) : topStreak && topStreak[1] >= 3 ? (
            <>
              <span className="tile-label">Longest streak</span>
              <p>
                🔥 <b>{topStreak[0]}</b> has played {topStreak[1]} days in a row
              </p>
            </>
          ) : (
            <div className="flex items-center gap-[clamp(8px,0.7vw,14px)]">
              <span className="shrink-0 rounded-[6px] bg-white p-[3px] ring-2 ring-primary">
                <PlayQr className="h-[clamp(40px,3.4vw,72px)] w-[clamp(40px,3.4vw,72px)]" />
              </span>
              <p>
                <b>Your turn</b>
                <br />
                <span className="text-muted-foreground">Scan to play</span>
              </p>
            </div>
          )}
        </div>
      </div>

    </Card>
  );
}
