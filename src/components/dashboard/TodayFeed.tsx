import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { useOfficeActivity, GAME_NAMES } from "@/hooks/useOfficeActivity";
import { PlayQr } from "./JoinCard";

interface Item {
  key: string;
  at: string;
  avatar: string;
  text: JSX.Element;
}

const ago = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h`;
};

/**
 * "Today in the office": everything that happened today, newest first. It fills whatever
 * room the Together column has left, showing as many rows as fit.
 */
export function TodayFeed() {
  const a = useOfficeActivity();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const av = (n: string) => a.players.get(n)?.avatar ?? "👤";

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const e of a.events) {
      if (e.day !== a.today || !e.at) continue;
      const board = a.todayByGame.get(e.game) ?? [];
      const rank = board.findIndex((x) => x.player === e.player) + 1;
      list.push({
        key: `p-${e.player}-${e.game}`,
        at: e.at,
        avatar: av(e.player),
        text: (
          <>
            <b className="font-semibold">{e.player}</b> played {GAME_NAMES[e.game] ?? e.game}
            {rank > 0 && <span className={rank === 1 ? "text-primary font-semibold" : "text-muted-foreground"}> · {rank === 1 ? "1st 🏆" : `#${rank}`}</span>}
          </>
        ),
      });
    }
    for (const c of a.challenges) {
      list.push({
        key: `c-${c.key}`,
        at: c.at,
        avatar: av(c.from),
        text: (
          <>
            <b className="font-semibold">{c.from}</b> challenged <b className="font-semibold">{c.to}</b> in {GAME_NAMES[c.game] ?? c.game}
            {c.status === "beaten" && <span className="text-green-700"> · beaten 🎯</span>}
          </>
        ),
      });
    }
    for (const s of a.teamRiddleSolves) {
      if (s.at.slice(0, 10) !== a.today) continue;
      list.push({ key: `t-${s.player}`, at: s.at, avatar: av(s.player), text: <><b className="font-semibold">{s.player}</b> cracked the team riddle 🧠</> });
    }
    return list.sort((x, y) => y.at.localeCompare(x.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a]);

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden p-[clamp(14px,1.3vw,28px)] gap-[clamp(8px,0.7vw,14px)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="tile-label">Today in the office</span>
        {items.length > 0 && <span className="tile-label tabular-nums">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <div className="m-auto flex items-center gap-[clamp(10px,0.9vw,18px)]">
          <span className="shrink-0 rounded-[6px] bg-white p-[3px] ring-2 ring-primary">
            <PlayQr className="h-[clamp(48px,4vw,88px)] w-[clamp(48px,4vw,88px)]" />
          </span>
          <p className="leading-snug text-[clamp(14px,1.05vw,22px)]">
            <span className="font-semibold">Quiet so far.</span>
            <br />
            <span className="text-muted-foreground">Scan and be the first today</span>
          </p>
        </div>
      ) : (
        // As many rows as fit; the bottom fades out instead of cutting a row in half
        <ul className="flex-1 min-h-0 overflow-hidden flex flex-col gap-[clamp(6px,0.55vw,12px)] [mask-image:linear-gradient(to_bottom,black_80%,transparent)]">
          {items.slice(0, 20).map((it, i) => (
            <li
              key={it.key}
              className={`flex items-center gap-[clamp(8px,0.7vw,14px)] text-[clamp(13px,1vw,21px)] leading-tight ${i === 0 ? "animate-in fade-in slide-in-from-top-2 duration-500" : ""}`}
            >
              <span className="shrink-0 leading-none text-[1.35em]">{it.avatar}</span>
              <span className="min-w-0 flex-1 truncate">{it.text}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground text-[0.8em]">{ago(it.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
