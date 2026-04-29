import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRounds } from "@/hooks/useRounds";
import { useScoring, calculateScore, calculateWordleScore } from "@/hooks/useScoring";
import { useGuesses } from "@/hooks/useGuesses";
import { useMinigameLeaderboardRound } from "@/hooks/useMinigameScore";
import { supabase } from "@/integrations/supabase/client";

const LEADERBOARD_ROTATE_SECONDS = 15;

const GAME_ROTATION = [
  { type: "geo" as const, title: "GeoGuessr", emoji: "🌍" },
  { type: "wordle" as const, title: "Wordle", emoji: "🟩" },
  { type: "mini" as const, gameId: "city_guess", title: "City Guess", emoji: "🏙️" },
  { type: "mini" as const, gameId: "color_memory", title: "Color Memory", emoji: "🎨" },
  { type: "mini" as const, gameId: "this_or_that", title: "This or That", emoji: "⚖️" },
  { type: "mini" as const, gameId: "sudoku", title: "Sudoku", emoji: "🔢" },
  { type: "mini" as const, gameId: "pairs", title: "Pairs", emoji: "🃏" },
  { type: "mini" as const, gameId: "labyrinth", title: "Labyrinth", emoji: "🌀" },
];

function chunkRotation<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

function useAvatarMap() {
  const { data: players } = useQuery({
    queryKey: ["players-avatars"],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("name, avatar");
      return data ?? [];
    },
  });

  return useMemo(() => new Map(players?.map((p) => [p.name, p.avatar]) ?? []), [players]);
}

function rankBadge(rank: number) {
  if (rank === 1) return <Trophy className="h-3.5 w-3.5 text-warning" />;
  if (rank === 2) return <Medal className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Medal className="h-3.5 w-3.5 text-warning/60" />;
}

function LeaderboardRows({
  rows,
  avatarMap,
}: {
  rows: { name: string; score: number; meta?: string }[];
  avatarMap: Map<string, string | null>;
}) {
  if (rows.length === 0) {
    return <p className="py-3 text-center text-xs text-muted-foreground">No scores yet</p>;
  }

  return (
    <div className="space-y-0.5">
      {rows.map((row, index) => (
        <div key={`${row.name}-${index}`} className="flex items-center gap-1 rounded-md bg-secondary/50 px-1.5 py-1">
          <div className="flex w-4 shrink-0 items-center justify-center">
            {rankBadge(index + 1)}
          </div>
          <span className="shrink-0 text-sm">{avatarMap.get(row.name) ?? "👤"}</span>
          <span className="min-w-0 truncate text-[11px] font-medium text-foreground">{row.name}</span>
          <div className="ml-auto shrink-0 text-right leading-tight">
            <div className="font-mono text-[11px] font-semibold text-accent">{row.score}</div>
            {row.meta ? <div className="text-[9px] text-muted-foreground">{row.meta}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompactBoardCard({
  title,
  emoji,
  rows,
  avatarMap,
}: {
  title: string;
  emoji: string;
  rows: { name: string; score: number; meta?: string }[];
  avatarMap: Map<string, string | null>;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="px-2 pb-1 pt-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <span>{emoji}</span>
          <span className="truncate">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col justify-center px-2 pb-2 pt-0">
        <LeaderboardRows rows={rows} avatarMap={avatarMap} />
      </CardContent>
    </Card>
  );
}

function GeoCompactCard() {
  const avatarMap = useAvatarMap();
  const { settings } = useScoring();
  const { difficulty_weights } = settings;
  const { rounds } = useRounds();

  const latestRound = useMemo(
    () => [...rounds].sort((a, b) => b.round_number - a.round_number)[0] ?? null,
    [rounds]
  );

  const { data: roundLocations } = useQuery({
    queryKey: ["round-locations", latestRound?.id],
    queryFn: async () => {
      if (!latestRound?.id) return [];
      const { data } = await supabase
        .from("locations")
        .select("id, difficulty")
        .eq("round_id", latestRound.id);
      return data ?? [];
    },
    enabled: !!latestRound?.id,
  });

  const easyLocationId = roundLocations?.find((location) => location.difficulty === 1)?.id;
  const hardLocationId = roundLocations?.find((location) => location.difficulty === 3)?.id;
  const { guesses: easyGuesses } = useGuesses(easyLocationId);
  const { guesses: hardGuesses } = useGuesses(hardLocationId);

  const rows = useMemo(() => {
    const byPlayer = new Map<string, { easy: number; hard: number }>();

    for (const guess of easyGuesses) {
      const score = calculateScore(guess.distance_km, guess.guess_number ?? 1, settings);
      const current = byPlayer.get(guess.player_name) ?? { easy: 0, hard: 0 };
      current.easy = Math.max(current.easy, score);
      byPlayer.set(guess.player_name, current);
    }

    for (const guess of hardGuesses) {
      const score = calculateScore(guess.distance_km, guess.guess_number ?? 1, settings);
      const current = byPlayer.get(guess.player_name) ?? { easy: 0, hard: 0 };
      current.hard = Math.max(current.hard, score);
      byPlayer.set(guess.player_name, current);
    }

    return [...byPlayer.entries()]
      .map(([name, scores]) => ({
        name,
        score: Math.round(scores.easy * difficulty_weights.easy + scores.hard * difficulty_weights.hard),
        meta: `E ${scores.easy} · H ${scores.hard}`,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [difficulty_weights.easy, difficulty_weights.hard, easyGuesses, hardGuesses, settings]);

  return <CompactBoardCard title="GeoGuessr" emoji="🌍" rows={rows} avatarMap={avatarMap} />;
}

function WordleCompactCard() {
  const avatarMap = useAvatarMap();
  const { rounds } = useRounds();
  const { settings } = useScoring();

  const latestRound = useMemo(
    () => [...rounds].sort((a, b) => b.round_number - a.round_number)[0] ?? null,
    [rounds]
  );

  const { data: scores = [] } = useQuery({
    queryKey: ["wordle_leaderboard", latestRound?.id],
    queryFn: async () => {
      if (!latestRound?.id) return [];
      const { data } = await supabase
        .from("wordle_scores" as any)
        .select("*")
        .eq("round_id", latestRound.id)
        .order("attempts", { ascending: true });
      return (data ?? []) as any[];
    },
    enabled: !!latestRound?.id,
  });

  const rows = useMemo(() => {
    return [...scores]
      .sort((a, b) => {
        if (a.solved && !b.solved) return -1;
        if (!a.solved && b.solved) return 1;
        return a.attempts - b.attempts;
      })
      .slice(0, 3)
      .map((entry) => ({
        name: entry.player_name,
        score: entry.solved ? calculateWordleScore(entry.attempts, settings) : 0,
        meta: entry.solved ? `${entry.attempts}/6` : "failed",
      }));
  }, [scores, settings]);

  return <CompactBoardCard title="Wordle" emoji="🟩" rows={rows} avatarMap={avatarMap} />;
}

function MinigameCompactCard({
  gameId,
  title,
  emoji,
}: {
  gameId: string;
  title: string;
  emoji: string;
}) {
  const avatarMap = useAvatarMap();
  const { rounds } = useRounds();

  const latestRound = useMemo(
    () => [...rounds].sort((a, b) => b.round_number - a.round_number)[0] ?? null,
    [rounds]
  );

  const { data: scores = [] } = useMinigameLeaderboardRound(gameId, latestRound?.id);
  const rows = useMemo(
    () =>
      scores.slice(0, 3).map((entry) => ({
        name: entry.player_name,
        score: entry.score,
      })),
    [scores]
  );

  return <CompactBoardCard title={title} emoji={emoji} rows={rows} avatarMap={avatarMap} />;
}

function RotationCard({
  item,
}: {
  item: (typeof GAME_ROTATION)[number];
}) {
  if (item.type === "geo") return <GeoCompactCard />;
  if (item.type === "wordle") return <WordleCompactCard />;
  return <MinigameCompactCard gameId={item.gameId} title={item.title} emoji={item.emoji} />;
}

export function RotatingLeaderboard() {
  const [rotation, setRotation] = useState(0);
  const [timeLeft, setTimeLeft] = useState(LEADERBOARD_ROTATE_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setRotation((current) => current + 1);
          return LEADERBOARD_ROTATE_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  const pages = useMemo(() => chunkRotation(GAME_ROTATION, 4), []);
  const currentPage = pages[rotation % pages.length] ?? [];

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="px-2 pb-1 pt-2 md:px-3">
        <CardTitle className="flex items-center gap-1.5 text-sm md:text-[clamp(20px,1.5vw,36px)]">
          <Trophy className="h-4 w-4 text-primary md:h-[clamp(18px,1.2vw,24px)] md:w-[clamp(18px,1.2vw,24px)]" />
          Leaderboards
        </CardTitle>
      </CardHeader>
      <div className="px-2 md:px-3">
        <Progress value={(timeLeft / LEADERBOARD_ROTATE_SECONDS) * 100} className="h-[clamp(3px,0.2vw,6px)]" />
      </div>
      <CardContent className="min-h-0 flex-1 p-2 md:p-3">
        <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2">
          {currentPage.map((item) => (
            <div key={`${item.type}-${"gameId" in item ? item.gameId : item.title}`} className="min-h-0 h-full">
              <RotationCard item={item} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
