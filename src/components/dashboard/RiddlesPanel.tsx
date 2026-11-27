import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Check, Eye, Lock, Puzzle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useRounds } from "@/hooks/useRounds";
import { useMinigameLeaderboardRound, todayDate, dateSeed } from "@/hooks/useMinigameScore";
import { useOfficeActivity, TEAM_RIDDLE_CLUE_AT, weekIndex } from "@/hooks/useOfficeActivity";
import { RIDDLES } from "@/lib/riddles";
import { teamRiddleForWeek } from "@/lib/teamRiddles";
import { ACTIONABLE } from "@/hooks/useMe";

// The daily riddle's own colour: a calm sage, so it reads apart from the orange team riddle
const SAGE = "110 18% 46%";

const card = `h-full min-h-0 flex flex-col overflow-hidden p-[clamp(12px,1vw,22px)] gap-[clamp(6px,0.55vw,12px)] [container-type:size] ${ACTIONABLE}`;
const label = "tile-label flex items-center gap-[0.45em]";
const pad2 = (n: number) => String(n).padStart(2, "0");

/** The little "?" tile over the daily riddle, with a couple of sparkles drifting around it */
function RiddleMark() {
  return (
    <span aria-hidden className="relative block h-[clamp(30px,22cqh,60px)] w-[clamp(30px,22cqh,60px)] shrink-0">
      <span
        className="riddle-float absolute inset-0 flex items-center justify-center rounded-[28%] font-bold text-[0.62em]"
        style={{
          fontSize: "inherit",
          background: `linear-gradient(160deg, hsl(${SAGE} / 0.2), hsl(${SAGE} / 0.34))`,
          color: `hsl(${SAGE})`,
          boxShadow: `inset 0 1px 0 hsl(0 0% 100% / 0.7), 0 8px 20px -12px hsl(${SAGE} / 0.7)`,
        }}
      >
        <span className="text-[clamp(18px,13cqh,36px)] leading-none">?</span>
      </span>
      <span className="riddle-twinkle absolute -left-[45%] top-[30%] text-[clamp(10px,7cqh,18px)] leading-none" style={{ color: `hsl(${SAGE} / 0.7)` }}>+</span>
      <span className="riddle-twinkle absolute -right-[38%] bottom-[-8%] text-[clamp(10px,7cqh,18px)] leading-none [animation-delay:1.2s]" style={{ color: `hsl(${SAGE} / 0.7)` }}>+</span>
      <span className="riddle-twinkle absolute -right-[18%] -top-[12%] h-[0.3em] w-[0.3em] rounded-full text-[clamp(10px,7cqh,18px)] [animation-delay:0.6s]" style={{ background: `hsl(${SAGE} / 0.55)` }} />
    </span>
  );
}

/** Today's riddle: the question, and how many have solved it. Never the answer. */
function DailyRiddleCard() {
  const navigate = useNavigate();
  const { activeRound } = useRounds();
  const roundId = activeRound?.id;
  // Same pick as the phone game, so the TV and phones show the same riddle
  const riddle = RIDDLES[dateSeed(`${roundId ?? todayDate()}-riddle`) % RIDDLES.length];
  const { data: scores = [] } = useMinigameLeaderboardRound("riddle", roundId);
  const { right, total } = useMemo(() => {
    const byPlayer = new Map<string, boolean>();
    for (const s of scores) byPlayer.set(s.player_name, (byPlayer.get(s.player_name) ?? false) || s.score > 0);
    const v = [...byPlayer.values()];
    return { right: v.filter(Boolean).length, total: v.length };
  }, [scores]);
  const pct = total ? Math.round((right / total) * 100) : 0;

  return (
    <Card onClick={() => navigate("/play?game=riddle")} className={card}>
      <span className={label}>
        <Puzzle className="h-[1.05em] w-[1.05em]" style={{ color: `hsl(${SAGE})` }} />
        Daily riddle
      </span>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(6px,5cqh,16px)] text-center">
        <RiddleMark />
        <p key={riddle.question} className="line-clamp-3 text-balance font-semibold leading-[1.15] tracking-tight text-[clamp(15px,min(5.4cqw,11cqh),30px)] animate-in fade-in duration-700">
          {riddle.question}
        </p>
      </div>
      <div className="space-y-[clamp(4px,0.35vw,8px)]">
        <div className="flex items-baseline justify-between tabular-nums text-muted-foreground text-[clamp(11px,0.8vw,16px)]">
          <span>
            {right > 0 ? (
              <>
                Solved by <b className="font-semibold text-foreground">{right}</b> {right === 1 ? "person" : "people"}
              </>
            ) : total > 0 ? (
              "Nobody has cracked it yet"
            ) : (
              "Be the first to crack it"
            )}
          </span>
          {total > 0 && <span className="font-medium">{pct}%</span>}
        </div>
        <div className="h-[clamp(5px,0.4vw,8px)] overflow-hidden rounded-full bg-foreground/[0.07]">
          <div className="h-full rounded-full transition-[width] duration-1000 ease-out" style={{ width: `${pct}%`, background: `hsl(${SAGE})` }} />
        </div>
      </div>
    </Card>
  );
}

/** The team riddle of the week: the newest clue, the five clue chips, and how close the next one is */
function TeamRiddleCard() {
  const navigate = useNavigate();
  const a = useOfficeActivity();
  const r = teamRiddleForWeek(weekIndex(a.today));
  const total = TEAM_RIDDLE_CLUE_AT.length;
  const open = TEAM_RIDDLE_CLUE_AT.filter((n) => a.playsThisWeek >= n).length;
  const next = TEAM_RIDDLE_CLUE_AT[open];
  const prev = TEAM_RIDDLE_CLUE_AT[open - 1] ?? 0;
  const toNext = next === undefined ? 1 : Math.min(1, (a.playsThisWeek - prev) / (next - prev));
  const left = next === undefined ? 0 : next - a.playsThisWeek;
  const first = a.teamRiddleSolves[0];
  const firstName = (n: string) => n.trim().split(/\s+/)[0];

  return (
    <Card onClick={() => navigate("/play?game=team_riddle")} className={card}>
      <span className={label}>
        <Brain className="h-[1.05em] w-[1.05em] text-primary" />
        Team riddle
      </span>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(5px,4cqh,14px)] text-center">
        <span className="tabular-nums text-muted-foreground text-[clamp(11px,0.8vw,16px)]">
          Clue {pad2(open)} / {pad2(total)}
        </span>
        {open > 0 && (
          <p key={open} className="line-clamp-2 text-balance font-semibold leading-[1.15] tracking-tight text-[clamp(15px,min(5cqw,10cqh),28px)] animate-in fade-in slide-in-from-bottom-1 duration-700">
            “{r.clues[open - 1]}”
          </p>
        )}
        {/* One chip per clue: read, the newest one, and the locked ones */}
        <div className="flex gap-[clamp(4px,1.6cqw,10px)]">
          {r.clues.map((_, i) => {
            const state = i < open - 1 ? "read" : i === open - 1 ? "new" : "locked";
            const Icon = state === "read" ? Check : state === "new" ? Eye : Lock;
            return (
              <span
                key={i}
                title={state === "locked" ? `Unlocks at ${TEAM_RIDDLE_CLUE_AT[i]} games this week` : `Clue ${i + 1}`}
                className={`flex aspect-[1/1.1] w-[clamp(26px,10cqw,54px)] flex-col items-center justify-center gap-[0.15em] rounded-[clamp(6px,0.5vw,10px)] border tabular-nums text-[clamp(9px,2.6cqw,14px)] transition-colors duration-500 ${
                  state === "new"
                    ? "border-primary/40 bg-primary/15 text-primary shadow-[0_6px_16px_-10px_hsl(var(--primary))] animate-in zoom-in-90 duration-500"
                    : state === "read"
                      ? "border-transparent bg-foreground/[0.06] text-foreground/60"
                      : "border-foreground/10 bg-[hsl(var(--card))]/60 text-muted-foreground/70"
                }`}
              >
                <Icon className="h-[1.15em] w-[1.15em]" />
                {pad2(i + 1)}
              </span>
            );
          })}
        </div>
      </div>
      <div className="space-y-[clamp(4px,0.35vw,8px)] text-center">
        {next !== undefined ? (
          <p className="font-medium text-primary text-[clamp(11px,0.8vw,16px)]">
            {left} more {left === 1 ? "game" : "games"} to unlock clue {open + 1}
          </p>
        ) : (
          <p className="font-medium text-primary text-[clamp(11px,0.8vw,16px)]">All clues unlocked</p>
        )}
        <div className="h-[clamp(5px,0.4vw,8px)] overflow-hidden rounded-full bg-foreground/[0.07]">
          <div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out" style={{ width: `${toNext * 100}%` }} />
        </div>
        <p className="truncate text-muted-foreground text-[clamp(11px,0.8vw,16px)]">
          {first ? (
            <>
              Cracked by <PlayerAvatar avatar={a.players.get(first.player)?.avatar} name={first.player} size="1.3em" tv />{" "}
              <b className="font-semibold text-foreground">{firstName(first.player)}</b>
              {a.teamRiddleSolves.length > 1 && ` and ${a.teamRiddleSolves.length - 1} more`}
            </>
          ) : (
            "Still unsolved"
          )}
        </p>
      </div>
    </Card>
  );
}

/** Both riddles side by side, each in its own card: today's riddle, and the team riddle of the week. */
export function RiddlesPanel() {
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-[clamp(8px,0.7vw,14px)] animate-in fade-in duration-700">
      <DailyRiddleCard />
      <TeamRiddleCard />
      <style>{`
        @keyframes riddle-float { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-6%) rotate(3deg); } }
        @keyframes riddle-twinkle { 0%, 100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.1); } }
        .riddle-float { animation: riddle-float 5s ease-in-out infinite; }
        .riddle-twinkle { animation: riddle-twinkle 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .riddle-float, .riddle-twinkle { animation: none; } }
      `}</style>
    </div>
  );
}
