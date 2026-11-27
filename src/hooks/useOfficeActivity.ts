import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScoring, calculateScore, calculateWordleScore } from "@/hooks/useScoring";
import { todayDate } from "@/hooks/useMinigameScore";

/* ── Settings you might want to tweak ─────────────────────────────────── */

/** Games played this week (by anyone) that unlock Friday fika. */
export const OFFICE_GOAL = 50;
export const OFFICE_GOAL_REWARD = "Friday fika 🍰";
/** Team riddle clues unlock as the office plays: clue 1 is free, then at these weekly play counts. */
export const TEAM_RIDDLE_CLUE_AT = [0, 10, 20, 30, 40];

export const OFFICES: Record<string, { city: string; flag: string }> = {
  Sweden: { city: "Stockholm", flag: "🇸🇪" },
  US: { city: "New York", flag: "🇺🇸" },
  Bulgaria: { city: "Varna", flag: "🇧🇬" },
};

export const GAME_NAMES: Record<string, string> = {
  geo: "GeoGuessr",
  wordle: "Wordle",
  city_guess: "City Guess",
  color_memory: "Color Memory",
  this_or_that: "This or That",
  sudoku: "Sudoku",
  pairs: "Pairs",
  labyrinth: "Zip",
  riddle: "Riddle",
};

/** Rows in minigame_scores that aren't games */
const NOT_GAMES = new Set(["challenge", "team_riddle"]);

/* ── Types ──────────────────────────────────────────────────────────────────── */

export interface PlayEvent {
  player: string;
  game: string;
  day: string; // YYYY-MM-DD (same calendar as the games use)
  score: number; // higher is better, comparable within a game
  at: string; // ISO time it was saved
}

export interface Challenge {
  key: string;
  from: string;
  to: string;
  game: string;
  target: number;
  day: string;
  at: string;
  /** The challenged player's best score in that game that day, if they've played */
  answer: number | null;
  status: "open" | "beaten" | "held";
}

export interface PlayerInfo {
  name: string;
  avatar: string;
  office: string;
}

/* ── Date helpers (UTC calendar, like the games) ────────────────────────────────── */

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0 … Sun=6

export function weekStart(day = todayDate()): string {
  return addDays(day, -weekday(day));
}

/** Week number since an anchor, used to pick the weekly team riddle */
export function weekIndex(day = todayDate()): number {
  return Math.floor((Date.parse(`${weekStart(day)}T00:00:00Z`) - Date.parse("2026-01-05T00:00:00Z")) / (7 * 86_400_000));
}

/** Workday streak: weekdays in a row with at least one game, ending today (or the last workday). */
function workdayStreak(days: Set<string>, today: string): number {
  let d = today;
  // If today isn't played yet, the streak is still alive from the previous workday
  if (!days.has(d)) {
    d = addDays(d, -1);
    while (weekday(d) >= 5) d = addDays(d, -1);
  }
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
    while (weekday(d) >= 5) d = addDays(d, -1);
  }
  return n;
}

/**
 * Ranking points per game per day: 1st 5, 2nd 3, 3rd 2, everyone else who played 1.
 * A game only scores on a day when at least two people played it: winning alone isn't a win.
 */
function pointsFor(events: PlayEvent[]): Map<string, number> {
  const groups = new Map<string, PlayEvent[]>();
  for (const e of events) {
    const k = `${e.game}|${e.day}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(e);
  }
  const pts = new Map<string, number>();
  for (const list of groups.values()) {
    if (new Set(list.map((e) => e.player)).size < 2) continue; // played alone: no points (yet)
    const sorted = [...list].sort((a, b) => b.score - a.score);
    let rank = 0;
    let prev: number | null = null;
    for (const e of sorted) {
      if (e.score !== prev) rank++;
      prev = e.score;
      const p = rank === 1 ? 5 : rank === 2 ? 3 : rank === 3 ? 2 : 1;
      pts.set(e.player, (pts.get(e.player) ?? 0) + p);
    }
  }
  return pts;
}

/* ── The hook ───────────────────────────────────────────────────────────────────── */

/**
 * Everything the "play together" features need, from the tables that already exist.
 * One shared query (react-query dedupes it), refreshed every 20 seconds.
 */
export function useOfficeActivity() {
  const { settings } = useScoring();
  const since = addDays(todayDate(), -35);

  const { data } = useQuery({
    queryKey: ["office-activity", since],
    refetchInterval: 20_000,
    queryFn: async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const [mini, wordle, guesses, players] = await Promise.all([
        (supabase as any).from("minigame_scores").select("game_id, player_name, score, date, created_at, meta").gte("date", since),
        (supabase as any).from("wordle_scores").select("player_name, attempts, solved, created_at").gte("created_at", since),
        supabase.from("guesses").select("player_name, distance_km, guess_number, created_at").gte("created_at", since),
        supabase.from("players").select("name, avatar, office"),
      ]);
      return {
        mini: (mini.data ?? []) as any[],
        wordle: (wordle.data ?? []) as any[],
        guesses: (guesses.data ?? []) as any[],
        players: (players.data ?? []) as PlayerInfo[],
      };
      /* eslint-enable @typescript-eslint/no-explicit-any */
    },
  });

  return useMemo(() => {
    const today = todayDate();
    const thisWeek = weekStart(today);
    const lastWeek = addDays(thisWeek, -7);
    const players = new Map((data?.players ?? []).map((p) => [p.name, p]));

    // All plays, one per player per game per day (their best)
    const best = new Map<string, PlayEvent>();
    const add = (e: PlayEvent) => {
      const k = `${e.player}|${e.game}|${e.day}`;
      const cur = best.get(k);
      if (!cur || e.score > cur.score) best.set(k, { ...e, at: cur && cur.at > e.at ? cur.at : e.at });
    };
    for (const r of data?.mini ?? []) {
      if (NOT_GAMES.has(r.game_id)) continue;
      add({ player: r.player_name, game: r.game_id, day: r.date, score: r.score, at: r.created_at ?? "" });
    }
    for (const r of data?.wordle ?? []) {
      add({ player: r.player_name, game: "wordle", day: String(r.created_at).slice(0, 10), score: r.solved ? calculateWordleScore(r.attempts, settings) : 0, at: r.created_at ?? "" });
    }
    for (const r of data?.guesses ?? []) {
      add({ player: r.player_name, game: "geo", day: String(r.created_at).slice(0, 10), score: calculateScore(r.distance_km, r.guess_number ?? 1, settings), at: r.created_at ?? "" });
    }
    const events = [...best.values()].sort((a, b) => a.at.localeCompare(b.at));

    // Streaks
    const daysByPlayer = new Map<string, Set<string>>();
    for (const e of events) (daysByPlayer.get(e.player) ?? daysByPlayer.set(e.player, new Set()).get(e.player)!).add(e.day);
    const streaks = new Map<string, number>();
    for (const [p, days] of daysByPlayer) {
      const s = workdayStreak(days, today);
      if (s > 0) streaks.set(p, s);
    }

    // Weekly points, champions, offices
    const weekEvents = events.filter((e) => e.day >= thisWeek);
    const lastWeekEvents = events.filter((e) => e.day >= lastWeek && e.day < thisWeek);
    const weekPoints = pointsFor(weekEvents);
    const lastWeekPoints = pointsFor(lastWeekEvents);
    const ranked = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    const weekRanking = ranked(weekPoints);
    const lastWeekChampion = ranked(lastWeekPoints)[0]?.[0] ?? null;

    const officePoints = Object.keys(OFFICES).map((office) => ({
      office,
      ...OFFICES[office],
      points: weekRanking.filter(([p]) => players.get(p)?.office === office).reduce((s, [, v]) => s + v, 0),
      players: new Set(weekEvents.filter((e) => players.get(e.player)?.office === office).map((e) => e.player)).size,
    })).sort((a, b) => b.points - a.points);

    const playsThisWeek = weekEvents.length;

    // Today's board per game (for "took the lead" moments)
    const todayByGame = new Map<string, PlayEvent[]>();
    for (const e of events) if (e.day === today) (todayByGame.get(e.game) ?? todayByGame.set(e.game, []).get(e.game)!).push(e);
    for (const list of todayByGame.values()) list.sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));

    // Challenges (today only) and team riddle solves (this week)
    const challenges: Challenge[] = (data?.mini ?? [])
      .filter((r) => r.game_id === "challenge" && r.date === today && r.meta?.from && r.meta?.to && r.created_at)
      .map((r) => {
        const answer = best.get(`${r.meta.to}|${r.meta.game}|${today}`)?.score ?? null;
        const status: Challenge["status"] = answer === null ? "open" : answer > r.meta.target ? "beaten" : "held";
        return { key: r.player_name, from: r.meta.from, to: r.meta.to, game: r.meta.game, target: r.meta.target, day: r.date, at: r.created_at, answer, status };
      })
      .sort((a, b) => b.at.localeCompare(a.at));

    const teamRiddleSolves = (data?.mini ?? [])
      .filter((r) => r.game_id === "team_riddle" && r.date >= thisWeek && r.score > 0 && r.created_at)
      .map((r) => ({ player: r.player_name as string, at: r.created_at as string }))
      .sort((a, b) => a.at.localeCompare(b.at));

    return {
      loaded: !!data,
      today,
      thisWeek,
      players,
      events,
      streaks,
      weekRanking,
      lastWeekChampion,
      officePoints,
      playsThisWeek,
      todayByGame,
      challenges,
      teamRiddleSolves,
    };
  }, [data, settings]);
}

export type OfficeActivity = ReturnType<typeof useOfficeActivity>;
