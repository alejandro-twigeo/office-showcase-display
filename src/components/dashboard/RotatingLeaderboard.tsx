import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PlayQr } from "./JoinCard";
import { useSpotlight } from "./GameSpotlight";
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

type BoardRow = { name: string; score: number; meta?: string };

/**
 * One game's board, podium style: the leader gets the space, 2nd and 3rd sit underneath.
 * Empty boards stay quiet so the games people actually play stand out.
 */
function CompactBoardCard({
  title,
  emoji,
  rows,
  avatarMap,
}: {
  title: string;
  emoji: string;
  rows: BoardRow[];
  avatarMap: Map<string, string | null>;
}) {
  const [leader, ...rest] = rows;
  const avatar = (name: string) => avatarMap.get(name) ?? "👤";

  return (
    <Card
      className={`flex h-full min-h-0 flex-col overflow-hidden p-[clamp(8px,0.7vw,14px)] gap-[clamp(6px,0.5vw,10px)] ${
        leader ? "" : "bg-transparent shadow-none border-dashed border-foreground/15"
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm lg:text-[clamp(15px,1.1vw,24px)] leading-none">{emoji}</span>
        <span className={`truncate font-semibold text-sm lg:text-[clamp(14px,1vw,22px)] leading-none ${leader ? "text-foreground" : "text-muted-foreground"}`}>
          {title}
        </span>
      </div>

      {!leader ? (
        <div className="flex flex-1 min-h-0 items-center justify-center text-center">
          <p className="text-muted-foreground text-xs lg:text-[clamp(12px,0.85vw,17px)] leading-snug">
            No scores yet.
            <br />
            <span className="font-medium text-foreground/70">Be the first</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col gap-[clamp(4px,0.35vw,8px)]">
          {/* Leader */}
          <div className="flex min-h-0 flex-1 items-center gap-[clamp(6px,0.6vw,12px)] rounded-[clamp(8px,0.6vw,12px)] bg-primary/10 px-[clamp(8px,0.6vw,12px)] py-[clamp(4px,0.4vw,8px)]">
            <span className="shrink-0 leading-none text-[clamp(20px,1.6vw,38px)]">{avatar(leader.name)}</span>
            <div className="min-w-0 flex-1 flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 lg:h-[clamp(13px,0.95vw,20px)] lg:w-[clamp(13px,0.95vw,20px)] shrink-0 text-primary" />
              <p className="truncate font-semibold text-foreground text-sm lg:text-[clamp(14px,1.1vw,24px)] leading-tight">{leader.name}</p>
            </div>
            <div className="shrink-0 text-right leading-none">
              <div className="font-semibold tabular-nums text-primary text-base lg:text-[clamp(18px,1.5vw,34px)]">{leader.score}</div>
              {leader.meta ? (
                <div className="mt-0.5 text-muted-foreground text-[10px] lg:text-[clamp(10px,0.7vw,15px)]">{leader.meta}</div>
              ) : null}
            </div>
          </div>

          {/* 2nd and 3rd */}
          {rest.map((row, i) => (
            <div key={`${row.name}-${i}`} className="flex items-center gap-[clamp(4px,0.4vw,8px)] px-[clamp(4px,0.4vw,8px)]">
              <span className="w-[1.2em] shrink-0 text-center font-semibold tabular-nums text-muted-foreground text-[11px] lg:text-[clamp(12px,0.85vw,18px)]">
                {i + 2}
              </span>
              <span className="shrink-0 text-[13px] lg:text-[clamp(14px,1vw,22px)] leading-none">{avatar(row.name)}</span>
              <span className="min-w-0 flex-1 truncate text-foreground text-[11px] lg:text-[clamp(12px,0.9vw,19px)]">{row.name}</span>
              <span className="shrink-0 font-medium tabular-nums text-foreground text-[11px] lg:text-[clamp(12px,0.9vw,19px)]">{row.score}</span>
            </div>
          ))}
        </div>
      )}
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

export function RotatingLeaderboard({ wide = false, showQr = false }: { wide?: boolean; showQr?: boolean }) {
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

  const pageSize = wide ? 8 : 4;
  const pages = useMemo(() => chunkRotation(GAME_ROTATION, pageSize), [pageSize]);
  const currentPage = pages[rotation % pages.length] ?? [];
  const spotlight = useSpotlight();

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-[clamp(8px,0.8vw,16px)] px-[clamp(14px,1.3vw,28px)] pt-[clamp(14px,1.3vw,28px)] pb-[clamp(8px,0.7vw,14px)]">
        <div className="min-w-0 flex-1">
          <span className="tile-label">Today&rsquo;s leaders</span>
        </div>
        {showQr && (
          <div className="hidden lg:flex items-center gap-[clamp(6px,0.5vw,10px)] shrink-0">
            <span className="text-right text-muted-foreground leading-tight text-[clamp(12px,0.85vw,17px)]">
              Scan to
              <br />
              <span className="font-semibold text-foreground">join in</span>
            </span>
            <div className="rounded-[clamp(4px,0.3vw,6px)] bg-white p-[3px] ring-2 ring-primary">
              <PlayQr className="h-[clamp(40px,3.2vw,68px)] w-[clamp(40px,3.2vw,68px)]" />
            </div>
          </div>
        )}
      </div>
      {pages.length > 1 && (
        <div className="px-2 md:px-3">
          <Progress value={(timeLeft / LEADERBOARD_ROTATE_SECONDS) * 100} className="h-[clamp(3px,0.2vw,6px)]" />
        </div>
      )}
      <CardContent className="min-h-0 flex-1 p-[clamp(14px,1.3vw,28px)] pt-0">
        <div className={`grid h-full min-h-0 ${wide ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"} lg:grid-rows-2 gap-[clamp(6px,0.6vw,12px)]`}>
          {currentPage.map((item) => {
            const key = "gameId" in item ? item.gameId : item.type;
            const lit = spotlight?.gameKey === key;
            return (
              <div
                key={`${item.type}-${key}`}
                className={`min-h-0 h-full rounded-[clamp(12px,1vw,20px)] transition-all duration-500 ${
                  lit ? "relative z-10 scale-[1.04] ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                }`}
              >
                <RotationCard item={item} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
