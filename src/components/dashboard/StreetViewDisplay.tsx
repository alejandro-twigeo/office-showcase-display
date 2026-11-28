import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Binoculars, Brain, CheckCircle2, XCircle } from "lucide-react";
import { useRounds } from "@/hooks/useRounds";
import { useMinigameLeaderboardRound, todayDate, dateSeed } from "@/hooks/useMinigameScore";
import { RIDDLES } from "@/lib/riddles";
import { JoinCard } from "./JoinCard";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { RotatingLeaderboard } from "./RotatingLeaderboard";
import { TeamRiddleCard } from "./WeekTiles";
import { RiddlesPanel } from "./RiddlesPanel";
import { SwapTimer } from "./SwapTimer";
import { useNavigate } from "react-router-dom";
import { ACTIONABLE } from "@/hooks/useMe";

type ActiveLocation = ReturnType<typeof useActiveLocation>["activeLocation"];

const LEVELS = {
  Easy: { icon: Binoculars, colorClass: "text-primary" },
  Hard: { icon: Brain, colorClass: "text-destructive" },
} as const;

/** A random spot to drift to: a little zoomed in, nudged a few percent in any direction */
const drift = () => {
  const scale = 1.08 + Math.random() * 0.16;
  const room = ((scale - 1) / 2) * 100 * 0.9; // stay inside the photo's edges
  const x = (Math.random() * 2 - 1) * room;
  const y = (Math.random() * 2 - 1) * room;
  return `translate(${x.toFixed(1)}%, ${y.toFixed(1)}%) scale(${scale.toFixed(3)})`;
};

/**
 * Slow, random camera moves over a still photo (a Ken Burns effect): it zooms in and drifts
 * somewhere new, again and again, so the GeoGuessr tile feels alive. Each photo moves on its own.
 */
function useKenBurns() {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let from = "translate(0%, 0%) scale(1.04)";
    let anim: Animation | undefined;
    let stopped = false;
    const step = () => {
      if (stopped) return;
      const to = drift();
      anim = el.animate([{ transform: from }, { transform: to }], {
        duration: 9000 + Math.random() * 5000,
        easing: "cubic-bezier(0.45, 0, 0.55, 1)",
        fill: "forwards",
      });
      from = to;
      anim.onfinish = step;
    };
    // The two photos start out of step, so they never move together
    const t = setTimeout(step, Math.random() * 1500);
    return () => {
      stopped = true;
      clearTimeout(t);
      anim?.cancel();
    };
  }, []);
  return ref;
}

function GeoPhoto({ location, level }: { location: NonNullable<ActiveLocation>; level: keyof typeof LEVELS }) {
  const { icon: Icon, colorClass } = LEVELS[level];
  const img = useKenBurns();
  return (
    <div className="relative min-w-0 min-h-0 overflow-hidden rounded-[clamp(8px,0.6vw,12px)] bg-secondary">
      <img ref={img} src={location.pano_id!} alt={`${level} GeoGuessr location`} className="absolute inset-0 h-full w-full object-cover will-change-transform" />
      <span className="absolute left-[clamp(6px,0.5vw,10px)] top-[clamp(6px,0.5vw,10px)] z-[1] flex items-center gap-1 rounded-full bg-background px-[clamp(8px,0.6vw,12px)] py-[clamp(2px,0.2vw,4px)] text-[clamp(11px,0.8vw,16px)] font-semibold text-foreground shadow-sm">
        <Icon className={`h-[clamp(12px,0.9vw,18px)] w-[clamp(12px,0.9vw,18px)] ${colorClass}`} />
        {level}
      </span>
    </div>
  );
}

/** Both GeoGuessr photos in one tile, so the game gets one slot instead of two. */
function GeoCard({ easy, hard, fillHeight }: { easy: ActiveLocation; hard: ActiveLocation; fillHeight: boolean }) {
  const photos = [
    easy?.pano_id ? { location: easy, level: "Easy" as const } : null,
    hard?.pano_id ? { location: hard, level: "Hard" as const } : null,
  ].filter(Boolean) as { location: NonNullable<ActiveLocation>; level: keyof typeof LEVELS }[];

  return (
    <Card className={`${fillHeight ? "h-full" : "h-[240px] lg:h-full"} min-h-0 flex flex-col p-[clamp(11px,0.95vw,22px)] gap-[clamp(10px,0.9vw,18px)] animate-in fade-in duration-700`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="tile-label">Where is this?</span>
        <span className="tile-label">GeoGuessr</span>
      </div>
      <div className={`flex-1 min-h-0 grid gap-[clamp(6px,0.5vw,10px)] ${photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {photos.map((p) => (
          <GeoPhoto key={p.level} location={p.location} level={p.level} />
        ))}
      </div>
    </Card>
  );
}

/** Today's riddle on the TV: the question and how the office is doing. Never the answer. */
function RiddleCard({ fillHeight }: { fillHeight: boolean }) {
  const { activeRound } = useRounds();
  const roundId = activeRound?.id;
  // Same pick as the phone game, so the TV and phones show the same riddle
  const riddle = RIDDLES[dateSeed(`${roundId ?? todayDate()}-riddle`) % RIDDLES.length];
  const { data: scores = [] } = useMinigameLeaderboardRound("riddle", roundId);

  const { right, wrong } = useMemo(() => {
    const byPlayer = new Map<string, boolean>();
    for (const s of scores) byPlayer.set(s.player_name, (byPlayer.get(s.player_name) ?? false) || s.score > 0);
    const v = [...byPlayer.values()];
    return { right: v.filter(Boolean).length, wrong: v.filter((x) => !x).length };
  }, [scores]);
  const total = right + wrong;

  return (
    <Card className={`${fillHeight ? "h-full" : "h-[240px] lg:h-full"} min-h-0 flex flex-col p-[clamp(11px,0.95vw,22px)] gap-[clamp(10px,0.9vw,18px)] animate-in fade-in duration-700`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="tile-label">Riddle of the day</span>
        <span className="tile-label">🧩</span>
      </div>
      <div className="flex-1 min-h-0 flex items-center">
        <p className="font-semibold tracking-tight leading-[1.15] text-balance text-[clamp(20px,1.9vw,42px)]">{riddle.question}</p>
      </div>
      {total > 0 ? (
        <div className="space-y-[clamp(6px,0.5vw,10px)]">
          <div className="flex h-[clamp(8px,0.6vw,12px)] overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-green-600 transition-[width] duration-700" style={{ width: `${(right / total) * 100}%` }} />
            {wrong > 0 && <div className="h-full flex-1 bg-destructive/70" />}
          </div>
          <div className="flex justify-between tabular-nums text-[clamp(13px,0.95vw,20px)]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-[1em] w-[1em] text-green-600" /> {right} got it
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {wrong} didn&rsquo;t <XCircle className="h-[1em] w-[1em] text-destructive" />
            </span>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-[clamp(13px,0.95vw,20px)]">Nobody has cracked it yet. Answer on the Play page.</p>
      )}
    </Card>
  );
}

const SWITCH_EVERY_MS = 60_000;

/**
 * Bottom of the Play zone: one tile that moves on every minute, both riddles → GeoGuessr photos (slowly panning).
 * ?geo in the address starts on the photos.
 */
export function PlaySideTile() {
  const navigate = useNavigate();
  const { activeLocation: easy } = useActiveLocation(1);
  const { activeLocation: hard } = useActiveLocation(3);
  const hasGeo = !!easy?.pano_id || !!hard?.pano_id;
  const [slot, setSlot] = useState(() => (new URLSearchParams(window.location.search).has("geo") ? 1 : 0));
  useEffect(() => {
    const id = setInterval(() => setSlot((s) => (s + 1) % 2), SWITCH_EVERY_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="relative h-full">
      {slot === 1 && hasGeo ? (
        <div onClick={() => navigate("/play?game=geoguessr")} className={`h-full rounded-xl ${ACTIONABLE}`}>
          <GeoCard easy={easy} hard={hard} fillHeight />
        </div>
      ) : (
        <RiddlesPanel />
      )}
      {/* Only when there's something to switch to */}
      {hasGeo && <SwapTimer durationMs={SWITCH_EVERY_MS} cycleKey={slot} />}
    </div>
  );
}

/** Phones: the GeoGuessr photos as their own tile (not taking turns with the riddles). Nothing when there's no round. */
export function GeoTile({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const { activeLocation: easy } = useActiveLocation(1);
  const { activeLocation: hard } = useActiveLocation(3);
  if (!easy?.pano_id && !hard?.pano_id) return null;
  return (
    <div onClick={() => navigate("/play?game=geoguessr")} className={`rounded-xl ${ACTIONABLE} ${className}`}>
      <GeoCard easy={easy} hard={hard} fillHeight />
    </div>
  );
}

export function StreetViewDisplay({ forceDesktop = false }: { forceDesktop?: boolean }) {
  const { activeLocation: easy, isLoading: easyLoading } = useActiveLocation(1);
  const { activeLocation: hard, isLoading: hardLoading } = useActiveLocation(3);
  const hasRound = !!easy?.pano_id || !!hard?.pano_id;
  const showJoinCard = !easyLoading && !hardLoading && !hasRound;

  // Every minute the first tile moves on: GeoGuessr → riddle of the day → team riddle.
  // ?riddle or ?teamriddle in the address starts on that one.
  const [slot, setSlot] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.has("teamriddle") ? 2 : q.has("riddle") ? 1 : 0;
  });
  useEffect(() => {
    const id = setInterval(() => setSlot((s) => (s + 1) % 3), SWITCH_EVERY_MS);
    return () => clearInterval(id);
  }, []);
  const showRiddle = slot === 1;
  const showTeamRiddle = slot === 2;

  return (
    <div
      className={`${
        forceDesktop ? "h-full min-h-0 grid grid-cols-3" : "h-full min-h-0 flex flex-col lg:grid lg:grid-cols-3"
      } gap-3 lg:gap-[clamp(12px,1vw,18px)]`}
    >
      {showTeamRiddle ? (
        <TeamRiddleCard fillHeight={forceDesktop} />
      ) : showRiddle ? (
        <RiddleCard fillHeight={forceDesktop} />
      ) : showJoinCard ? (
        <Card className={`${forceDesktop ? "h-full" : "h-[220px] lg:h-full"} min-h-0 flex flex-col p-0 overflow-hidden`}>
          <JoinCard />
        </Card>
      ) : (
        <GeoCard easy={easy} hard={hard} fillHeight={forceDesktop} />
      )}
      <div className={`${forceDesktop ? "h-full min-h-0 col-span-2" : "min-h-[220px] lg:h-full lg:min-h-0 lg:col-span-2"}`}>
        {/* When the big QR card isn't showing, the leaderboard carries a small one */}
        <RotatingLeaderboard wide showQr={slot !== 0 || !showJoinCard} />
      </div>
    </div>
  );
}
