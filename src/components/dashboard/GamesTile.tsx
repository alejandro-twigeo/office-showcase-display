import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { useOfficeActivity, GAME_NAMES, type PlayEvent } from "@/hooks/useOfficeActivity";
import { useSpotlight } from "./GameSpotlight";
import { CountUp } from "@/components/ui/count-up";
import { useFlip } from "@/hooks/useFlip";
import { PlayQr } from "./JoinCard";
import { useNavigate } from "react-router-dom";
import { ACTIONABLE } from "@/hooks/useMe";
import { useGameIcons } from "@/hooks/useGameIcons";
import { Users, Play, Swords } from "lucide-react";

// A soft colour per game, used for the background art when no logo is uploaded in Manager
const GAME_HUE: Record<string, number> = {
  wordle: 130,
  geo: 8,
  city_guess: 210,
  color_memory: 320,
  this_or_that: 28,
  sudoku: 230,
  pairs: 350,
  labyrinth: 35,
};
const ALL_GAMES = Object.keys(GAME_HUE);
// Logos are uploaded in Manager under the Play page's game ids
const iconKey = (g: string) => (g === "geo" ? "geoguessr" : g);
const HOT_MS = 3 * 60_000;
// All eight games get a card (3 × 3 grid); the ninth slot holds the challenges, a streak or the QR
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

/** A player's avatar: their bot (see PlayerAvatar), or a picture if it's a link */
function Avatar({ value, name }: { value?: string; name: string }) {
  const v = value || "";
  return /^(https?:|data:|\/)/.test(v) ? (
    <img src={v} alt="" className="h-[1.35em] w-[1.35em] shrink-0 rounded-full object-cover" draggable={false} />
  ) : (
    <PlayerAvatar avatar={v} name={name} size="1.5em" tv />
  );
}

/** First names only; first name + last initial when two people share a first name */
function makeShortName(names: Iterable<string>) {
  const byFirst = new Map<string, Set<string>>();
  for (const n of names) {
    const first = n.trim().split(/\s+/)[0];
    if (!byFirst.has(first)) byFirst.set(first, new Set());
    byFirst.get(first)!.add(n.trim());
  }
  return (full: string) => {
    const parts = full.trim().split(/\s+/);
    const first = parts[0];
    if ((byFirst.get(first)?.size ?? 0) > 1 && parts.length > 1) return `${first} ${parts[parts.length - 1][0]}.`;
    return first;
  };
}

const MEDAL = ["bg-amber-200/70 text-amber-900", "bg-stone-200/80 text-stone-700", "bg-orange-200/60 text-orange-900"];

/**
 * Top three of one game: rank, name, score, one quiet row each. Every row is the same element
 * keyed by player, so when someone overtakes, the rows slide into their new places and the score
 * counts up. Sizes follow the card's width (cqw), so names fit on the TV and on a laptop alike.
 */
function Podium({
  rows,
  badges,
  avatar,
  short,
}: {
  rows: PlayEvent[];
  badges: (n: string) => JSX.Element | null;
  avatar: (n: string) => string | undefined;
  short: (n: string) => string;
}) {
  const ref = useFlip<HTMLDivElement>([rows.map((r) => r.player).join("|")]);
  return (
    // flex-wrap: a row that doesn't fit wraps out of view instead of showing half
    <div ref={ref} className="relative z-[1] mt-[clamp(2px,0.3vw,8px)] flex min-h-0 flex-1 flex-col flex-wrap content-start overflow-hidden">
      {rows.map((e, i) => (
        <div
          key={e.player}
          data-flip={e.player}
          className={`flex w-full items-center gap-[clamp(5px,2cqw,10px)] py-[clamp(4px,1.6cqw,10px)] text-[clamp(13px,4.8cqw,24px)] ${
            i > 0 ? "border-t border-foreground/[0.07]" : ""
          }`}
        >
          <span
            className={`flex h-[1.6em] w-[1.6em] shrink-0 items-center justify-center rounded-full text-[0.8em] font-semibold tabular-nums ${MEDAL[i]}`}
          >
            {i + 1}
          </span>
          <Avatar value={avatar(e.player)} name={e.player} />
          <span className={`flex min-w-0 flex-1 items-center gap-1 ${i === 0 ? "font-semibold" : "font-medium"}`} title={e.player}>
            <span className="truncate">{short(e.player)}</span>
            {badges(e.player)}
          </span>
          <CountUp value={e.score} className={`shrink-0 tabular-nums text-primary ${i === 0 ? "font-semibold" : "font-medium"}`} />
        </div>
      ))}
    </div>
  );
}

/** The game's logo as soft background art in the card's corner (or a soft colour if there's none) */
function GameArt({ src, hue }: { src?: string; hue: number }) {
  return src ? (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className="pointer-events-none absolute -bottom-[30%] -right-[10%] h-[100%] w-auto max-w-[62%] rotate-[-10deg] object-contain opacity-[0.22] blur-[1px] saturate-[1.2] [mask-image:linear-gradient(to_top_left,black_40%,transparent_90%)]"
    />
  ) : (
    <span
      aria-hidden
      className="pointer-events-none absolute -bottom-[25%] -right-[18%] aspect-square h-[120%] rounded-full opacity-70 blur-[18px]"
      style={{ background: `radial-gradient(closest-side, hsl(${hue} 85% 75% / 0.55), transparent)` }}
    />
  );
}

/** A small round play button in the corner: the whole card opens the game, this just says so */
function PlayButton() {
  return (
    <span
      aria-hidden
      className="absolute bottom-[clamp(8px,0.65vw,14px)] right-[clamp(8px,0.65vw,14px)] z-[1] flex h-[clamp(24px,7cqw,38px)] w-[clamp(24px,7cqw,38px)] items-center justify-center rounded-full bg-[hsl(var(--card))] text-foreground/80 shadow-[0_4px_14px_-6px_hsl(var(--foreground)/0.3)]"
    >
      <Play className="ml-[8%] h-[38%] w-[38%] fill-current" />
    </span>
  );
}

/**
 * The Play zone's main tile: today's most played games, each with its podium.
 * A game played in the last few minutes lights up with "+1" and who played it.
 */
export function GamesTile() {
  const a = useOfficeActivity();
  const spotlight = useSpotlight();
  const { icons } = useGameIcons();
  // On a laptop a card opens that game on the Play page
  const navigate = useNavigate();
  const openGame = (g: string) => navigate(`/play?game=${g === "geo" ? "geoguessr" : g}`);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);

  const av = (n: string) => <PlayerAvatar avatar={a.players.get(n)?.avatar} name={n} size="1.3em" tv />;
  const short = useMemo(
    () =>
      makeShortName([
        ...a.players.keys(),
        ...[...a.todayByGame.values()].flat().map((e) => e.player),
        ...a.challenges.flatMap((c) => [c.from, c.to]),
      ]),
    [a.players, a.todayByGame, a.challenges]
  );
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

  // Something worth a nudge in the ninth slot: up to three challenges (open ones first), else the longest streak
  const challenges = [...a.challenges].sort((x, y) => Number(y.status === "open") - Number(x.status === "open") || y.at.localeCompare(x.at)).slice(0, 3);
  const topStreak = [...a.streaks.entries()].sort((x, y) => y[1] - x[1])[0];

  return (
    <Card className="h-full min-h-0 flex flex-col p-[clamp(12px,1.05vw,24px)] gap-[clamp(8px,0.65vw,14px)]">
      <div className="flex items-center justify-between gap-3">
        <span className="tile-label">
          Games · <CountUp value={todayCount} /> played today
        </span>
        <ActivityMeter level={activityLevel(lastHour)} label="Activity" />
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-3 grid-rows-3 gap-[clamp(6px,0.55vw,12px)]">
        {games.shown.map((g) => {
          const board = a.todayByGame.get(g) ?? [];
          const [lead, ...rest] = board;
          const last = latest(g);
          const hot = !!last && now - Date.parse(last.at) < HOT_MS;
          const lit = spotlight?.gameKey === g;
          return (
            <div
              key={g}
              onClick={() => openGame(g)}
              className={`relative flex min-h-0 flex-col gap-[clamp(4px,0.4vw,8px)] overflow-hidden [container-type:inline-size] rounded-[clamp(10px,0.85vw,18px)] p-[clamp(10px,0.8vw,18px)] transition-all duration-500 ${ACTIONABLE} ${
                hot ? "bg-green-600/10 shadow-[0_0_0_2px_hsl(142_60%_45%/0.45)]" : lead ? "bg-background" : "border border-dashed border-foreground/15"
              } ${lit ? "shadow-[0_0_0_3px_hsl(var(--primary))] scale-[1.02]" : ""}`}
            >
              <GameArt src={icons[iconKey(g)]} hue={GAME_HUE[g] ?? 25} />
              {hot && last && (
                <span className="absolute right-[clamp(8px,0.7vw,14px)] top-[clamp(6px,0.5vw,10px)] z-10 rounded-full bg-[hsl(var(--card))] px-[0.8em] py-[0.25em] font-semibold shadow-[0_8px_24px_-10px_rgba(0,0,0,0.35)] text-[clamp(12px,0.85vw,18px)] animate-in fade-in zoom-in-90 duration-500">
                  +1 {av(last.player)} {short(last.player)}
                </span>
              )}
              <div className="relative z-[1] flex items-center justify-between gap-2">
                <span className={`truncate font-semibold text-[clamp(14px,5.2cqw,26px)] ${lead ? "" : "text-muted-foreground"}`}>
                  {GAME_NAMES[g] ?? g}
                </span>
                {board.length > 0 && (
                  <span className="flex shrink-0 items-center gap-[0.35em] text-muted-foreground tabular-nums text-[clamp(11px,0.8vw,17px)]" title={`${board.length} played today`}>
                    <Users className="h-[1.05em] w-[1.05em]" />
                    {board.length}
                  </span>
                )}
              </div>
              {lead ? (
                <Podium rows={[lead, ...rest].slice(0, 3)} badges={badges} avatar={(n) => a.players.get(n)?.avatar} short={short} />
              ) : (
                <p className="relative z-[1] m-auto text-center text-muted-foreground text-[clamp(11px,0.8vw,16px)]">
                  <span className="font-medium text-foreground/70">Be the first</span>
                </p>
              )}
              <PlayButton />
            </div>
          );
        })}
        {/* Ninth slot: something to nudge people with */}
        <div onClick={() => navigate("/play?tab=games")} className={`flex min-h-0 flex-col [container-type:inline-size] ${challenges.length ? "justify-start" : "justify-center"} gap-[clamp(6px,0.5vw,10px)] rounded-[clamp(10px,0.85vw,18px)] ${challenges.length ? "bg-background" : "bg-primary/[0.07]"} p-[clamp(10px,0.8vw,18px)] text-[clamp(12px,0.9vw,19px)] leading-snug ${ACTIONABLE}`}>
          {challenges.length > 0 ? (
            <>
              <span className="flex items-center gap-[0.4em] font-semibold text-[clamp(14px,5.2cqw,26px)]">
                <Swords className="h-[1em] w-[1em] text-primary" />
                Challenges
              </span>
              <div className="flex min-h-0 flex-col overflow-hidden">
                {challenges.map((c, i) => (
                  <div
                    key={`${c.key}-${c.at}`}
                    className={`flex items-center gap-[clamp(4px,1.6cqw,10px)] py-[clamp(4px,1.6cqw,10px)] text-[clamp(12px,4.8cqw,24px)] ${
                      i > 0 ? "border-t border-foreground/[0.07]" : ""
                    } ${c.status === "open" ? "" : "text-muted-foreground"}`}
                  >
                    <span className="min-w-0 truncate font-medium" title={c.from}>{short(c.from)}</span>
                    <Swords className="h-[0.9em] w-[0.9em] shrink-0 text-primary/70" aria-label="challenged" />
                    <span className="min-w-0 truncate font-medium" title={c.to}>{short(c.to)}</span>
                    {icons[iconKey(c.game)] ? (
                      <img src={icons[iconKey(c.game)]} alt={GAME_NAMES[c.game] ?? c.game} title={GAME_NAMES[c.game] ?? c.game} className="ml-auto h-[1.5em] w-[1.5em] shrink-0 rounded-[5px] object-contain" />
                    ) : (
                      <span
                        title={GAME_NAMES[c.game] ?? c.game}
                        className="ml-auto flex h-[1.5em] w-[1.5em] shrink-0 items-center justify-center rounded-[5px] text-[0.75em] font-semibold"
                        style={{ background: `hsl(${GAME_HUE[c.game] ?? 25} 80% 85%)` }}
                      >
                        {(GAME_NAMES[c.game] ?? c.game).charAt(0)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : topStreak && topStreak[1] >= 3 ? (
            <>
              <span className="tile-label">Longest streak</span>
              <p>
                🔥 <b>{short(topStreak[0])}</b> has played {topStreak[1]} days in a row
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
