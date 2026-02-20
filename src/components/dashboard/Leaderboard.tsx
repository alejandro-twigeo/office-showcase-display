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

  // For each user: keep their first try (guess_number=1) + up to 2 best by distance
  const entriesPerUser = new Map<string, Guess[]>();

  for (const guess of guesses) {
    const existing = entriesPerUser.get(guess.player_name) ?? [];
    entriesPerUser.set(guess.player_name, [...existing, guess]);
  }

  const selectedEntries: Guess[] = [];

  for (const [, userGuesses] of entriesPerUser) {
    const firstTry = userGuesses.find((g) => (g.guess_number ?? 1) === 1);
    const sortedByDist = [...userGuesses].sort((a, b) => a.distance_km - b.distance_km);

    const picked = new Set<string>();
    if (firstTry) picked.add(firstTry.id);

    for (const g of sortedByDist) {
      if (picked.size >= 3) break;
      picked.add(g.id);
    }

    selectedEntries.push(...userGuesses.filter((g) => picked.has(g.id)));
  }

  const sorted = selectedEntries.sort((a, b) => a.distance_km - b.distance_km);

  // Track first occurrence of each player name for display
  const seenPlayers = new Set<string>();

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-warning" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-warning/60" />;
    return <span className="w-5 text-center text-sm text-muted-foreground">{rank}</span>;
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

  // Build render items: full rows for first occurrence, dot for repeats
  const items = sorted.map((guess) => {
    const isFirst = !seenPlayers.has(guess.player_name);
    seenPlayers.add(guess.player_name);
    return { guess, isFirst };
  });

  // Collapse consecutive dots of the same user into a group
  type RenderItem =
    | { type: 'row'; guess: Guess; rank: number }
    | { type: 'dots'; count: number; names: string[] };

  const renderItems: RenderItem[] = [];
  let rank = 0;

  for (const { guess, isFirst } of items) {
    if (isFirst) {
      rank++;
      renderItems.push({ type: 'row', guess, rank });
    } else {
      const last = renderItems[renderItems.length - 1];
      if (last?.type === 'dots') {
        last.count++;
        if (!last.names.includes(guess.player_name)) last.names.push(guess.player_name);
      } else {
        renderItems.push({ type: 'dots', count: 1, names: [guess.player_name] });
      }
    }
  }

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

            // Dot row — small circles, one per hidden entry
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
