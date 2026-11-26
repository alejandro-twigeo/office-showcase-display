import { Card } from "@/components/ui/card";
import { Lock, CheckCircle2 } from "lucide-react";
import {
  useOfficeActivity,
  OFFICE_GOAL,
  OFFICE_GOAL_REWARD,
  TEAM_RIDDLE_CLUE_AT,
  weekIndex,
} from "@/hooks/useOfficeActivity";
import { teamRiddleForWeek } from "@/lib/teamRiddles";

const avatarOf = (a: ReturnType<typeof useOfficeActivity>, name: string) => a.players.get(name)?.avatar ?? "👤";

/** Friday afternoon (Stockholm) the leader becomes the champion of the week. */
function isRevealTime(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Stockholm", weekday: "short", hour: "2-digit", hour12: false })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return parts.weekday === "Fri" && Number(parts.hour) >= 15;
}

/**
 * This week at a glance: who's leading, the office goal, and the office race.
 * Shown in the news tile when there's no news, and every other minute when there is.
 */
export function ThisWeekCard({ compact = false }: { compact?: boolean }) {
  const a = useOfficeActivity();
  const [leader, leaderPts] = a.weekRanking[0] ?? [];
  const reveal = isRevealTime();
  const goalPct = Math.min(100, (a.playsThisWeek / OFFICE_GOAL) * 100);
  const goalDone = a.playsThisWeek >= OFFICE_GOAL;
  const maxOffice = Math.max(1, ...a.officePoints.map((o) => o.points));

  return (
    <Card className="h-full min-h-0 flex flex-col justify-between overflow-hidden p-[clamp(14px,1.3vw,28px)] gap-[clamp(8px,0.7vw,14px)] animate-in fade-in duration-700">
      <div className="flex items-baseline justify-between gap-3">
        <span className="tile-label">This week</span>
        <span className="tile-label">Resets Monday</span>
      </div>

      {/* Champion */}
      <div className="flex items-center gap-[clamp(10px,0.8vw,16px)]">
        <span className="relative shrink-0 leading-none text-[clamp(30px,2.6vw,56px)]">
          {leader ? avatarOf(a, leader) : "🏆"}
          {leader && <span className="absolute -top-[0.45em] left-1/2 -translate-x-1/2 text-[0.55em] crown-bob">👑</span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[clamp(12px,0.85vw,18px)]">{reveal ? "Champion of the week" : "Leading the week"}</p>
          <p className="truncate font-semibold tracking-tight text-[clamp(20px,1.7vw,36px)] leading-tight">
            {leader ?? "Nobody yet. Play to take it"}
          </p>
        </div>
        {leader && (
          <span className="shrink-0 font-semibold tabular-nums text-primary text-[clamp(18px,1.5vw,32px)]">
            {leaderPts}
            <span className="ml-1 text-muted-foreground font-normal text-[clamp(11px,0.75vw,15px)]">pts</span>
          </span>
        )}
      </div>

      {/* Office goal */}
      <div className="space-y-[clamp(5px,0.4vw,8px)]">
        <div className="flex items-baseline justify-between gap-2 text-[clamp(13px,0.95vw,20px)]">
          <span className="font-medium">{goalDone ? `Goal reached: ${OFFICE_GOAL_REWARD}` : `Office goal: ${OFFICE_GOAL_REWARD}`}</span>
          <span className="tabular-nums text-muted-foreground">
            {Math.min(a.playsThisWeek, OFFICE_GOAL)} / {OFFICE_GOAL} games
          </span>
        </div>
        <div className="h-[clamp(10px,0.75vw,16px)] overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-out ${goalDone ? "bg-green-600" : "bg-primary"}`}
            style={{ width: `${goalPct}%` }}
          />
        </div>
      </div>

      {/* Office race (in the header in the new layout, so the compact card leaves it out) */}
      <div className={`flex flex-col gap-[clamp(5px,0.45vw,9px)] ${compact ? "hidden" : ""}`}>
        <p className="text-muted-foreground text-[clamp(12px,0.85vw,18px)]">Office race</p>
        {a.officePoints.map((o, i) => (
          <div key={o.office} className="grid grid-cols-[minmax(0,7.5em)_minmax(0,1fr)_3em] items-center gap-[clamp(8px,0.6vw,12px)] text-[clamp(13px,0.95vw,20px)]">
            <span className={`truncate ${i === 0 && o.points > 0 ? "font-semibold" : ""}`}>
              {o.flag} {o.city}
            </span>
            <div className="h-[clamp(8px,0.6vw,12px)] overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ease-out ${i === 0 && o.points > 0 ? "bg-primary" : "bg-foreground/25"}`}
                style={{ width: `${(o.points / maxOffice) * 100}%` }}
              />
            </div>
            <span className="text-right tabular-nums text-muted-foreground">{o.points}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Team riddle of the week on the TV: clues unlock as the office plays. Never shows the answer. */
export function TeamRiddleCard({ fillHeight }: { fillHeight: boolean }) {
  const a = useOfficeActivity();
  const riddle = teamRiddleForWeek(weekIndex(a.today));
  const solvers = a.teamRiddleSolves;
  const first = solvers[0];

  return (
    <Card className={`${fillHeight ? "h-full" : "h-[240px] lg:h-full"} min-h-0 flex flex-col p-[clamp(14px,1.3vw,28px)] gap-[clamp(8px,0.7vw,14px)] animate-in fade-in duration-700`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="tile-label">Team riddle of the week</span>
        <span className="tile-label">Who or what am I?</span>
      </div>
      <ol className="flex-1 min-h-0 flex flex-col justify-center gap-[clamp(4px,0.4vw,8px)]">
        {riddle.clues.map((clue, i) => {
          const unlocked = a.playsThisWeek >= TEAM_RIDDLE_CLUE_AT[i];
          return (
            <li key={i} className="flex items-start gap-[clamp(8px,0.6vw,12px)] text-[clamp(13px,1vw,21px)] leading-snug">
              <span className={`mt-[0.1em] flex h-[1.4em] w-[1.4em] shrink-0 items-center justify-center rounded-full text-[0.75em] font-semibold ${unlocked ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                {i + 1}
              </span>
              {unlocked ? (
                <span className="animate-in fade-in duration-700">{clue}</span>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-[0.9em] w-[0.9em]" /> Unlocks at {TEAM_RIDDLE_CLUE_AT[i]} games this week
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-[clamp(12px,0.9vw,19px)]">
        {first ? (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-[1em] w-[1em] text-green-600" />
            Cracked by {a.players.get(first.player)?.avatar ?? ""} <strong>{first.player}</strong>
            {solvers.length > 1 && <span className="text-muted-foreground">and {solvers.length - 1} more</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">Every game anyone plays unlocks more clues. Answer on the Play page.</span>
        )}
      </p>
    </Card>
  );
}
