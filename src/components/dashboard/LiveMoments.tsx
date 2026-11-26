import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOfficeActivity, GAME_NAMES, type OfficeActivity } from "@/hooks/useOfficeActivity";

interface Moment {
  id: string;
  avatar: string;
  title: string;
  detail?: string;
  tone: "lead" | "streak" | "play" | "challenge" | "win";
}

const SHOW_MS = 7000;
const STREAK_MILESTONES = new Set([3, 5, 10, 15, 20, 30]);

/**
 * "Just happened" on the TV: a small card at the bottom of the screen when someone takes a lead,
 * hits a streak, sends or beats a challenge, or cracks the team riddle. One at a time.
 */
export function LiveMoments() {
  const a = useOfficeActivity();
  const [queue, setQueue] = useState<Moment[]>([]);
  const [current, setCurrent] = useState<Moment | null>(null);

  // What we have already seen, so only new things become moments
  const seen = useRef<{ plays: Map<string, string>; leaders: Map<string, string>; challenges: Map<string, string>; solves: number } | null>(null);

  useEffect(() => {
    if (!a.loaded) return;
    const snapshot = takeSnapshot(a);
    const prev = seen.current;
    seen.current = snapshot;
    if (!prev) return; // first load: nothing is "new"

    const found: Moment[] = [];
    const av = (n: string) => a.players.get(n)?.avatar ?? "👤";

    // New or improved plays today
    for (const e of a.events) {
      if (e.day !== a.today) continue;
      const k = `${e.player}|${e.game}`;
      if (prev.plays.get(k) === e.at) continue;
      const game = GAME_NAMES[e.game] ?? e.game;
      const board = a.todayByGame.get(e.game) ?? [];
      const rank = board.findIndex((x) => x.player === e.player) + 1;
      const prevLeader = prev.leaders.get(e.game);
      const streak = a.streaks.get(e.player) ?? 0;
      if (rank === 1 && prevLeader && prevLeader !== e.player) {
        found.push({ id: `lead-${k}-${e.at}`, avatar: av(e.player), title: `${e.player} took the ${game} lead`, detail: `from ${prevLeader}`, tone: "lead" });
      } else if (rank === 1 && !prevLeader) {
        found.push({ id: `first-${k}-${e.at}`, avatar: av(e.player), title: `${e.player} set the first ${game} score`, detail: "Who can beat it?", tone: "lead" });
      } else if (!prev.plays.has(k) && STREAK_MILESTONES.has(streak)) {
        found.push({ id: `streak-${k}-${e.at}`, avatar: av(e.player), title: `${e.player} is on a ${streak}-day streak`, detail: "🔥 Keep it going", tone: "streak" });
      } else if (!prev.plays.has(k)) {
        found.push({ id: `play-${k}-${e.at}`, avatar: av(e.player), title: `${e.player} just played ${game}`, detail: rank > 0 ? `#${rank} today` : undefined, tone: "play" });
      }
    }

    // Challenges: new ones, and ones that just got beaten
    for (const c of a.challenges) {
      const game = GAME_NAMES[c.game] ?? c.game;
      const before = prev.challenges.get(c.key);
      if (!before) {
        found.push({ id: `ch-${c.key}`, avatar: av(c.from), title: `${c.from} challenged ${c.to}`, detail: `Beat ${c.target} in ${game}`, tone: "challenge" });
      } else if (before !== "beaten" && c.status === "beaten") {
        found.push({ id: `chw-${c.key}`, avatar: av(c.to), title: `${c.to} beat ${c.from}'s challenge`, detail: `${c.answer} vs ${c.target} in ${game}`, tone: "win" });
      }
    }

    // Team riddle cracked
    if (a.teamRiddleSolves.length > prev.solves) {
      const s = a.teamRiddleSolves[a.teamRiddleSolves.length - 1];
      found.push({ id: `tr-${s.player}-${s.at}`, avatar: av(s.player), title: `${s.player} cracked the team riddle`, detail: prev.solves === 0 ? "First in the office!" : undefined, tone: "win" });
    }

    if (found.length) setQueue((q) => [...q, ...found].slice(-6));
  }, [a]);

  // Show them one at a time
  useEffect(() => {
    if (current || !queue.length) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
    const t = setTimeout(() => setCurrent(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [current, queue]);

  // Preview: open the TV with ?moments to see one
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("moments")) return;
    const t = setTimeout(
      () => setQueue((q) => [...q, { id: "demo", avatar: "🐧", title: "Sara took the Wordle lead", detail: "from Neil", tone: "lead" }]),
      2500
    );
    return () => clearTimeout(t);
  }, []);

  if (!current) return null;
  const toneDot = {
    lead: "bg-primary",
    streak: "bg-orange-500",
    play: "bg-foreground/30",
    challenge: "bg-violet-500",
    win: "bg-green-600",
  }[current.tone];

  return createPortal(
    <div className="tv-2027 pointer-events-none fixed inset-x-0 bottom-[clamp(18px,2vw,40px)] z-[55] flex justify-center">
      <div
        key={current.id}
        className="flex items-center gap-[clamp(12px,1vw,20px)] rounded-full bg-[hsl(var(--card))] py-[clamp(10px,0.8vw,16px)] pl-[clamp(12px,0.9vw,18px)] pr-[clamp(22px,1.8vw,36px)] shadow-[0_18px_50px_-18px_hsl(var(--foreground)/0.45)] animate-in fade-in slide-in-from-bottom-6 zoom-in-95 duration-500"
      >
        <span className="relative leading-none text-[clamp(28px,2.4vw,52px)]">
          {current.avatar}
          <span className={`absolute -right-0.5 -top-0.5 h-[0.3em] w-[0.3em] rounded-full ring-2 ring-[hsl(var(--card))] ${toneDot}`} />
        </span>
        <div className="leading-tight">
          <p className="font-semibold tracking-tight text-[clamp(17px,1.4vw,30px)]">{current.title}</p>
          {current.detail && <p className="text-muted-foreground text-[clamp(13px,1vw,21px)]">{current.detail}</p>}
        </div>
      </div>
    </div>,
    document.body
  );
}

function takeSnapshot(a: OfficeActivity) {
  const plays = new Map<string, string>();
  for (const e of a.events) if (e.day === a.today) plays.set(`${e.player}|${e.game}`, e.at);
  const leaders = new Map<string, string>();
  for (const [game, board] of a.todayByGame) if (board[0]) leaders.set(game, board[0].player);
  const challenges = new Map(a.challenges.map((c) => [c.key, c.status]));
  return { plays, leaders, challenges, solves: a.teamRiddleSolves.length };
}
