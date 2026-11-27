import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { usePositiveMessages, type PositiveMessage } from "@/hooks/usePositiveMessages";
import { usePollRotations } from "@/contexts/pollRotation";
import { ROTATE_SECONDS } from "@/components/dashboard/PollDisplay";
import { supabase } from "@/integrations/supabase/client";
import { parseKudos, isKudosLive, type KudosSegment } from "@/lib/kudos";
import { PlayQr } from "./JoinCard";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useMe, ACTIONABLE } from "@/hooks/useMe";
import { useKudosReactions } from "@/hooks/useKudosReactions";
import { ReactionBar } from "@/components/ReactionBar";
import { HandHeart } from "@/components/Squiggles";

const EMPTY_MSG = "Give someone kudos this week. Type @ and their name";
const CELEBRATE_MS = 8000;

function usePlayers() {
  const { data } = useQuery({
    queryKey: ["players-avatars"],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("name, avatar");
      return data ?? [];
    },
  });
  return useMemo(() => new Map((data ?? []).map((p) => [p.name, p.avatar as string | null])), [data]);
}

/** A tagged name: orange with avatar if they play, outlined if they haven't joined yet. */
function Tag({ name, known, avatar, big = false }: { name: string; known: boolean; avatar?: string | null; big?: boolean }) {
  return (
    // Inline (not a box), so it sits on the text line instead of pushing the lines around it
    <span
      className={`whitespace-nowrap rounded-full px-[0.35em] font-semibold [box-decoration-break:clone] ${
        known ? "bg-primary/15 text-foreground" : "outline outline-1 outline-dashed outline-foreground/35 text-foreground"
      } ${big ? "" : ""}`}
    >
      {known ? <PlayerAvatar avatar={avatar} name={name} size="1.3em" tv className="mr-[0.2em]" /> : null}
      {name}
    </span>
  );
}

function Rendered({ segments, avatars }: { segments: KudosSegment[]; avatars: Map<string, string | null> }) {
  return (
    <>
      {segments.map((s, i) =>
        "text" in s ? <span key={i}>{s.text}</span> : <Tag key={i} name={s.name} known={s.known} avatar={avatars.get(s.name)} />
      )}
    </>
  );
}

const CONFETTI_COLORS = ["hsl(22 100% 56%)", "#16a34a", "#eab308", "#ec4899", "#3b82f6", "#f97316"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.4,
        duration: 2.6 + Math.random() * 2.2,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.6,
        drift: (Math.random() - 0.5) * 160,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-[-4%]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/** Full-screen moment when new kudos lands: confetti, who it's for, and who sent it. */
function KudosCelebration({ msg, avatars, playerNames }: { msg: PositiveMessage; avatars: Map<string, string | null>; playerNames: string[] }) {
  const { segments, tagged } = parseKudos(msg.message, playerNames);
  const newcomers = tagged.filter((t) => !t.known);
  const headline = tagged.length ? tagged.map((t) => t.name).join(" & ") : "the team";

  return createPortal(
    <div className="tv-2027 fixed inset-0 z-[60] flex items-center justify-center bg-background/80 animate-in fade-in duration-300">
      <Confetti />
      <div className="relative mx-[6vw] max-w-[60vw] rounded-[clamp(18px,1.6vw,32px)] bg-[hsl(var(--card))] px-[clamp(28px,3vw,64px)] py-[clamp(24px,2.6vw,56px)] text-center shadow-[0_24px_80px_-24px_hsl(var(--foreground)/0.35)] animate-in zoom-in-90 fade-in duration-500">
        <p className="tile-label">Kudos 🎉</p>
        <h2 className="mt-[clamp(6px,0.6vw,12px)] font-semibold tracking-tight leading-[1.05] text-[clamp(32px,3.6vw,80px)]">
          {tagged.length ? <PlayerAvatar avatar={avatars.get(tagged[0].name)} name={tagged[0].name} size="1.2em" tv state="working" className="mr-[0.2em]" /> : null}
          {headline}
        </h2>
        <p className="mx-auto mt-[clamp(10px,1vw,20px)] max-w-[40ch] leading-snug text-[clamp(18px,1.6vw,34px)]">
          <Rendered segments={segments} avatars={avatars} />
        </p>
        {msg.created_by && <p className="mt-[clamp(8px,0.8vw,16px)] text-muted-foreground text-[clamp(14px,1.1vw,24px)]">from {msg.created_by}</p>}
        {newcomers.length > 0 && (
          <div className="mt-[clamp(14px,1.4vw,28px)] inline-flex items-center gap-[clamp(10px,0.9vw,18px)] rounded-[clamp(10px,0.9vw,18px)] bg-secondary px-[clamp(12px,1.1vw,22px)] py-[clamp(8px,0.7vw,14px)] text-left">
            <div className="shrink-0 rounded-[6px] bg-white p-[3px] ring-2 ring-primary">
              <PlayQr className="h-[clamp(48px,4vw,88px)] w-[clamp(48px,4vw,88px)]" />
            </div>
            <p className="leading-tight text-[clamp(14px,1.05vw,22px)]">
              <span className="font-semibold">{newcomers.map((n) => n.name).join(" & ")}, you&rsquo;re not on the board yet.</span>
              <br />
              <span className="text-muted-foreground">Scan to join and give kudos back</span>
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/** Celebrate kudos that arrive while the TV is on (not the ones already there when it loads). */
function useCelebration(all: PositiveMessage[]) {
  const seenRef = useRef<Set<string> | null>(null);
  const [celebrating, setCelebrating] = useState<PositiveMessage | null>(null);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const ids = new Set(all.map((m) => m.id));
    if (seenRef.current === null) {
      if (all.length) seenRef.current = ids;
      return;
    }
    const fresh = all.find((m) => !seenRef.current!.has(m.id));
    ids.forEach((id) => seenRef.current!.add(id));
    if (!fresh) return;
    setCelebrating(fresh);
    clearTimeout(celebrateTimer.current);
    celebrateTimer.current = setTimeout(() => setCelebrating(null), CELEBRATE_MS);
  }, [all]);
  useEffect(() => () => clearTimeout(celebrateTimer.current), []);

  // Preview: open the TV with ?kudos to see the celebration with the latest message
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("kudos")) return;
    const t = setTimeout(() => all[0] && setCelebrating(all[0]), 2000);
    return () => clearTimeout(t);
  }, [all.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return celebrating;
}

/** Kudos still on the TV (each has its own end date). Re-checked every few minutes. */
function useLiveKudos(all: PositiveMessage[]) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5 * 60_000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => all.filter((m) => isKudosLive(m, now)), [all, now]);
}

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

const SCROLL_PX_PER_S = 22;

/**
 * A list that scrolls up on its own, slowly and in a loop, when it's taller than its box (and sits
 * still when it fits). Pauses while the mouse is over it. The loop shows the list twice, so it never jumps.
 */
function AutoScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState<{ distance: number; seconds: number } | null>(null);
  useEffect(() => {
    const b = box.current;
    const l = list.current;
    if (!b || !l) return;
    const check = () => {
      const gap = parseFloat(getComputedStyle(l).rowGap) || 0;
      const h = l.scrollHeight;
      const overflow = h > b.clientHeight + 2;
      setScroll(overflow ? { distance: h + gap, seconds: (h + gap) / SCROLL_PX_PER_S } : null);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(b);
    ro.observe(l);
    return () => ro.disconnect();
  }, []);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const moving = !!scroll && !reduced;
  const listClass = "flex flex-col gap-[clamp(6px,0.55vw,11px)]";
  return (
    <div
      ref={box}
      className={`group min-h-0 overflow-hidden ${moving ? "[mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]" : ""} ${className}`}
    >
      <div
        className={moving ? "group-hover:[animation-play-state:paused]" : ""}
        style={moving ? { animation: `kudos-scroll ${scroll!.seconds}s linear infinite`, ["--kudos-scroll" as string]: `-${scroll!.distance}px` } : undefined}
      >
        <div ref={list} className={listClass}>
          {children}
        </div>
        {moving && (
          <div aria-hidden className={`${listClass} pt-[clamp(6px,0.55vw,11px)]`}>
            {children}
          </div>
        )}
      </div>
      <style>{`@keyframes kudos-scroll { from { transform: translateY(0) } to { transform: translateY(var(--kudos-scroll)) } }`}</style>
    </div>
  );
}

/**
 * Kudos as a tile (Together zone): the latest kudos large, the earlier ones underneath (scrolling
 * when they don't fit), and the full-screen celebration when a new one arrives. Each kudos stays
 * until its end date.
 */
export function KudosTile() {
  const { messages: all } = usePositiveMessages();
  const avatars = usePlayers();
  const playerNames = useMemo(() => [...avatars.keys()], [avatars]);
  const messages = useLiveKudos(all);
  const celebrating = useCelebration(all);
  const [latest, ...earlier] = messages;
  // On a laptop the tile is clickable: react right here, or open Kudos on the Play page
  const navigate = useNavigate();
  const me = useMe();
  const { forKudos, toggle } = useKudosReactions(me);
  const openKudos = () => navigate("/play?tab=kudos");
  const react = (kudosId: string) => (emoji: string) => (me ? toggle.mutate({ kudosId, emoji }) : openKudos());

  return (
    <Card onClick={openKudos} className={`h-full min-h-0 flex flex-col overflow-hidden p-[clamp(11px,0.95vw,22px)] gap-[clamp(8px,0.7vw,14px)] ${ACTIONABLE}`}>
      <span className="tile-label flex items-center gap-[0.4em]">
        <HandHeart key={latest?.id ?? "none"} className="h-[1.15em] w-auto" />
        Kudos
      </span>
      {latest ? (
        // "safe" centring: when it doesn't fit, it starts at the top instead of spilling over the title
        <div className={`flex min-h-0 flex-1 flex-col gap-[clamp(8px,0.7vw,14px)] overflow-hidden ${earlier.length < 2 ? "[justify-content:safe_center]" : ""}`}>
          <div key={latest.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className={`font-semibold tracking-tight leading-[1.3] line-clamp-2 ${earlier.length < 2 ? "text-[clamp(18px,1.6vw,36px)]" : "text-[clamp(17px,1.45vw,32px)]"}`}>
              <Rendered segments={parseKudos(latest.message, playerNames).segments} avatars={avatars} />
            </p>
            {/* Who sent it and the reactions share one line, so they still fit when the tile is short */}
            <div className="mt-[clamp(4px,0.4vw,8px)] flex flex-wrap items-center gap-x-[clamp(8px,0.7vw,14px)] gap-y-1">
              <span className="text-muted-foreground text-[clamp(12px,0.85vw,18px)]">
                {latest.created_by && <>from <PlayerAvatar avatar={avatars.get(latest.created_by)} name={latest.created_by} size="1.3em" tv /> {latest.created_by} · </>}
                {ago(latest.created_at)}
              </span>
              <ReactionBar size="tv" reactions={forKudos(latest.id)} onReact={react(latest.id)} />
            </div>
          </div>
          {/* Earlier kudos: when they don't all fit, they scroll by slowly on their own */}
          <AutoScroll className={`pt-[clamp(2px,0.2vw,4px)] ${earlier.length < 2 ? "" : "flex-1"}`}>
            {earlier.slice(0, 40).map((m) => (
              <p key={m.id} className="truncate text-[clamp(13px,0.95vw,20px)] animate-in fade-in duration-500">
                💛 <Rendered segments={parseKudos(m.message, playerNames).segments} avatars={avatars} />
                {m.created_by && <span className="text-muted-foreground"> · {m.created_by}</span>}
                {forKudos(m.id).length > 0 && (
                  <span className="text-muted-foreground"> · {forKudos(m.id).map((r) => `${r.emoji}${r.count}`).join(" ")}</span>
                )}
              </p>
            ))}
          </AutoScroll>
        </div>
      ) : (
        <p className="m-auto text-center text-muted-foreground text-[clamp(14px,1.05vw,22px)]">{EMPTY_MSG} ✨</p>
      )}
      {celebrating && <KudosCelebration msg={celebrating} avatars={avatars} playerNames={playerNames} />}
    </Card>
  );
}

/**
 * Header banner on the TV: this week's kudos, one at a time. Tagged people are highlighted,
 * and new kudos get a short celebration on screen. Older weeks drop off every Monday.
 */
export function PositiveMessagesBanner() {
  const { messages: all } = usePositiveMessages();
  const avatars = usePlayers();
  const playerNames = useMemo(() => [...avatars.keys()], [avatars]);

  const messages = useLiveKudos(all);

  const [index, setIndex] = useState(0);
  const { rotations, pollTimeLeft } = usePollRotations();

  useEffect(() => {
    setIndex(0);
  }, [messages.length]);

  // advance every 2 poll rotations
  useEffect(() => {
    if (rotations > 0 && rotations % 2 === 0 && messages.length > 1) {
      setIndex((i) => (i + 1) % messages.length);
    }
  }, [rotations, messages.length]);

  const celebrating = useCelebration(all);

  const current = messages.length > 0 ? messages[index % messages.length] : null;

  // Detect overflow to conditionally enable marquee
  const textRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = textRef.current;
      const container = containerRef.current;
      if (!el || !container) return;
      setOverflows(el.scrollWidth > container.clientWidth + 2);
    });
    return () => cancelAnimationFrame(id);
  }, [index, current?.id]);

  const totalElapsed = (rotations % 2 === 1 ? ROTATE_SECONDS : 0) + (ROTATE_SECONDS - pollTimeLeft);
  const countdown = ROTATE_SECONDS * 2 - totalElapsed;
  const segments = current ? parseKudos(current.message, playerNames).segments : [];

  return (
    <div className="overflow-hidden w-full">
      <div className="px-[clamp(20px,1.8vw,40px)] py-[clamp(12px,1vw,24px)] flex flex-col items-center gap-1">
        <div ref={containerRef} className="w-full overflow-hidden">
          <p
            ref={textRef}
            key={current?.id ?? "empty"}
            className={`text-[clamp(16px,1.4vw,30px)] font-medium leading-snug whitespace-nowrap text-center ${overflows ? "animate-marquee-if-needed" : ""}`}
          >
            {current ? (
              <>
                <Rendered segments={segments} avatars={avatars} />
                {current.created_by && <span className="text-muted-foreground font-normal ml-2">from {current.created_by}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">{EMPTY_MSG} ✨</span>
            )}
          </p>
        </div>

        {messages.length > 1 && (
          <span className="text-[clamp(12px,0.85vw,18px)] text-muted-foreground tabular-nums">
            Kudos · {index % messages.length + 1}/{messages.length} · {countdown}s
          </span>
        )}
      </div>
      {celebrating && <KudosCelebration msg={celebrating} avatars={avatars} playerNames={playerNames} />}
    </div>
  );
}
