import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useOfficeActivity, OFFICES, pointsFor, type PlayEvent } from "@/hooks/useOfficeActivity";
import { todayDate } from "@/hooks/useMinigameScore";

/**
 * SAMPLE DATA: true shows made-up numbers so the chart can be judged before there's a month of
 * real play. Set to false to chart the real games from the last 30 days (the code below is ready).
 */
const USE_SAMPLE = true;

const DAYS = 30;
type By = "city" | "department" | "people";
const BY_LABEL: Record<By, string> = { city: "City", department: "Department", people: "People" };

/* Soft, distinct line colours; the first goes to the top group (or to you, by people) */
const PALETTE = ["hsl(var(--primary))", "#3D8BFF", "#17C3AE", "#9A62FF", "#F2588E", "#E0A100", "#7A8699"];

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isWorkday = (day: string) => {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay();
  return w !== 0 && w !== 6;
};
const shortDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** The workdays in the last 30 days, oldest first */
function workdays(): string[] {
  const today = todayDate();
  const out: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    if (isWorkday(d)) out.push(d);
  }
  return out;
}

/* ── Sample data: steady, believable curves (same every load) ─────────────────── */

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const SAMPLE_GROUPS: Record<By, { name: string; base: number }[]> = {
  city: [
    { name: "Stockholm", base: 38 },
    { name: "Varna", base: 26 },
    { name: "New York", base: 16 },
  ],
  department: [
    { name: "Analytics", base: 24 },
    { name: "Paid Social", base: 20 },
    { name: "Creative", base: 16 },
    { name: "Engineering", base: 12 },
    { name: "Operations", base: 8 },
  ],
  people: [
    { name: "Lisa Sandahl", base: 9 },
    { name: "Emma", base: 7.5 },
    { name: "Giacomo", base: 6 },
    { name: "Martin", base: 5 },
    { name: "Sara", base: 4 },
  ],
};

function sampleSeries(by: By, days: string[], me: string) {
  const groups = SAMPLE_GROUPS[by].map((g) => ({ ...g }));
  if (by === "people" && !groups.some((g) => g.name === me)) groups.splice(1, 0, { name: me, base: 8 });
  const rows = days.map((day) => ({ day }) as Record<string, number | string>);
  groups.forEach((g, gi) => {
    const rnd = seeded(gi * 97 + by.length * 13 + 7);
    days.forEach((_, i) => {
      const trend = 0.75 + (0.5 * i) / Math.max(1, days.length - 1); // the office warms up over the month
      const wave = 1 + 0.18 * Math.sin(i / 2.2 + gi);
      const noise = 0.7 + rnd() * 0.6;
      rows[i][g.name] = Math.max(0, Math.round(g.base * trend * wave * noise));
    });
  });
  return { rows, names: groups.map((g) => g.name) };
}

/* ── Real data: ranking points per workday, grouped ──────────────────────────── */

function useDepartments(enabled: boolean) {
  return useQuery({
    queryKey: ["players-departments"],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("players").select("name, department");
      return new Map((data ?? []).map((p) => [p.name as string, (p.department as string | null) ?? "Other"]));
    },
  });
}

function realSeries(by: By, days: string[], me: string, a: ReturnType<typeof useOfficeActivity>, depts: Map<string, string> | undefined) {
  const first = days[0];
  const groupOf = (player: string) =>
    by === "city"
      ? OFFICES[a.players.get(player)?.office ?? ""]?.city ?? "Other"
      : by === "department"
        ? depts?.get(player) ?? "Other"
        : player;
  // The same points as the weekly ranking (1st 5, 2nd 3, 3rd 2, others 1; a game only scores
  // on a day when 2+ people played it), worked out day by day
  const eventsByDay = new Map<string, PlayEvent[]>();
  for (const e of a.events) {
    if (e.day < first || !isWorkday(e.day)) continue;
    (eventsByDay.get(e.day) ?? eventsByDay.set(e.day, []).get(e.day)!).push(e);
  }
  const counts = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const [day, list] of eventsByDay) {
    for (const [player, pts] of pointsFor(list)) {
      const g = groupOf(player);
      const byDay = counts.get(g) ?? counts.set(g, new Map()).get(g)!;
      byDay.set(day, (byDay.get(day) ?? 0) + pts);
      totals.set(g, (totals.get(g) ?? 0) + pts);
    }
  }
  let names = [...totals.entries()].sort((x, y) => y[1] - x[1]).map(([n]) => n);
  // People: the five most active, and always you
  if (by === "people") {
    names = names.slice(0, 5);
    if (!names.includes(me) && totals.has(me)) names.push(me);
  } else {
    names = names.slice(0, 7);
  }
  const rows = days.map((day) => {
    const row: Record<string, number | string> = { day };
    for (const n of names) row[n] = counts.get(n)?.get(day) ?? 0;
    return row;
  });
  return { rows, names };
}

/* ── The chart ───────────────────────────────────────────────────────────────── */

/** Ranking points earned each workday over the last 30 days, by city, department or person. */
export function ActivityChart({ playerName }: { playerName: string }) {
  const [by, setBy] = useState<By>("city");
  const [focus, setFocus] = useState<string | null>(null);
  const a = useOfficeActivity();
  const { data: depts } = useDepartments(!USE_SAMPLE && by === "department");
  const days = useMemo(workdays, []);

  const { rows, names } = useMemo(
    () => (USE_SAMPLE ? sampleSeries(by, days, playerName) : realSeries(by, days, playerName, a, depts)),
    [by, days, playerName, a, depts],
  );
  const colour = (name: string, i: number) =>
    by === "people" ? (name === playerName ? PALETTE[0] : PALETTE[(i % (PALETTE.length - 1)) + 1]) : PALETTE[i % PALETTE.length];
  const totals = names.map((n) => rows.reduce((s, r) => s + Number(r[n] ?? 0), 0));
  const empty = totals.every((t) => t === 0);

  return (
    <section className="glass-panel rounded-2xl p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            Points
            {USE_SAMPLE && <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">Sample data</span>}
          </p>
          <p className="text-xs text-muted-foreground">Earned each workday, last 30 days</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-0.5 rounded-full bg-foreground/[0.05] p-1 sm:w-auto">
          {(Object.keys(BY_LABEL) as By[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setBy(k);
                setFocus(null);
              }}
              aria-current={by === k ? "page" : undefined}
              className="seg-tab h-7 px-3 text-xs"
            >
              {BY_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No points in the last 30 days yet</p>
      ) : (
        <div className="mt-3 h-44 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--foreground) / 0.06)" />
              <XAxis
                dataKey="day"
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={40}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                cursor={{ stroke: "hsl(var(--foreground) / 0.15)", strokeWidth: 1 }}
                labelFormatter={(d) => shortDate(String(d))}
                formatter={(v, n) => [`${v} pts`, n === playerName ? "You" : n]}
                itemSorter={(item) => -Number(item.value ?? 0)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(0 0% 100% / 0.8)",
                  background: "hsl(0 0% 100% / 0.92)",
                  boxShadow: "0 12px 30px -16px rgba(0,0,0,0.35)",
                  fontSize: 12,
                  padding: "8px 10px",
                }}
                itemStyle={{ padding: 0 }}
              />
              {names.map((n, i) => (
                <Line
                  key={n}
                  type="monotone"
                  dataKey={n}
                  stroke={colour(n, i)}
                  strokeWidth={n === playerName || focus === n ? 2.6 : 1.8}
                  strokeOpacity={focus && focus !== n ? 0.15 : 1}
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 0 }}
                  // Off: recharts can draw nothing when it animates before the box has its width
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend: tap one to bring its line forward, with its total for the month */}
      {!empty && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {names.map((n, i) => (
            <button
              key={n}
              type="button"
              onClick={() => setFocus((f) => (f === n ? null : n))}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                focus === n ? "bg-white shadow-sm" : "bg-foreground/[0.04] hover:bg-white/70"
              } ${focus && focus !== n ? "opacity-50" : ""}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colour(n, i) }} />
              <span className="font-medium">{n === playerName ? "You" : n}</span>
              <span className="tabular-nums text-muted-foreground">{totals[i]}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
