import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, User } from 'lucide-react';
import { useScoring, calculateScore } from '@/hooks/useScoring';

interface Guess {
  id: string;
  player_name: string;
  distance_km: number;
  guess_number?: number;
}

interface LeaderboardProps {
  guesses: Guess[];
}

export function Leaderboard({ guesses }: LeaderboardProps) {
  const { settings } = useScoring();

  // Step 1: Determine which guess IDs get a full row (max 3 per user)
  const fullRowIds = new Set<string>();

  const byPlayer = new Map<string, Guess[]>();
  for (const g of guesses) {
    byPlayer.set(g.player_name, [...(byPlayer.get(g.player_name) ?? []), g]);
  }

  for (const [, playerGuesses] of byPlayer) {
    const firstTry = playerGuesses.find((g) => (g.guess_number ?? 1) === 1);
    const sortedByDist = [...playerGuesses].sort((a, b) => a.distance_km - b.distance_km);

    const pickedForPlayer = new Set<string>();
    if (firstTry) pickedForPlayer.add(firstTry.id);

    for (const g of sortedByDist) {
      if (pickedForPlayer.size >= 3) break;
      pickedForPlayer.add(g.id);
    }

    for (const id of pickedForPlayer) fullRowIds.add(id);
  }

  // Step 2: Sort ALL guesses by distance
  const allSorted = [...guesses].sort((a, b) => a.distance_km - b.distance_km);

  // Step 3: Build render list — full rows interspersed with dot groups
  type RowItem = { type: 'row'; guess: Guess; rank: number };
  type DotItem = { type: 'dots'; count: number };
  type RenderItem = RowItem | DotItem;

  const renderItems: RenderItem[] = [];
  let rank = 0;

  for (const guess of allSorted) {
    if (fullRowIds.has(guess.id)) {
      rank++;
      renderItems.push({ type: 'row', guess, rank });
    } else {
      const last = renderItems[renderItems.length - 1];
      if (last?.type === 'dots') {
        last.count++;
      } else {
        renderItems.push({ type: 'dots', count: 1 });
      }
    }
  }

  const getRankIcon = (r: number) => {
    if (r === 1) return <Trophy className="h-5 w-5 text-warning" />;
    if (r === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (r === 3) return <Medal className="h-5 w-5 text-warning/60" />;
    return <span className="w-5 text-center text-sm text-muted-foreground">{r}</span>;
  };

  const formatScoreLabel = (guess: Guess) => {
    const guessNumber = guess.guess_number ?? 1;
    const score = calculateScore(guess.distance_km, guessNumber, settings);
    const km =
      guess.distance_km < 1
        ? `${Math.round(guess.distance_km * 1000)} m`
        : `${Math.round(guess.distance_km)} km`;
    return `${score} pts (${km})`;
  };

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[clamp(20px,1.5vw,60px)]">
          <Trophy className="h-[clamp(18px,1.2vw,26px)] w-[clamp(18px,1.2vw,50px)] text-primary" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 overflow-y-auto min-h-0 flex-1">
        {renderItems.length === 0 ? (
          <p className="text-muted-foreground text-center py-4 text-[clamp(14px,1vw,34px)]">
            No guesses yet. Be the first!
          </p>
        ) : (
          renderItems.map((item, i) => {
            if (item.type === 'row') {
              return (
                <div
                  key={item.guess.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center justify-center w-6 shrink-0">
                    {getRankIcon(item.rank)}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 min-w-0">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-[clamp(14px,1vw,18px)] break-all">
                      {item.guess.player_name}
                    </span>
                  </div>
                  <span className="text-[clamp(14px,1vw,18px)] font-mono text-accent font-semibold ml-auto shrink-0 whitespace-nowrap">
                    {formatScoreLabel(item.guess)}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={`dots-${i}`}
                className="flex items-center justify-center gap-1.5 py-0.5 px-2"
              >
                {Array.from({ length: item.count }).map((_, di) => (
                  <span
                    key={di}
                    className="inline-block w-2 h-2 rounded-full bg-muted-foreground/30"
                  />
                ))}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
