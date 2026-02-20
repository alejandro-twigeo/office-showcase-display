import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal } from 'lucide-react';
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

function InitialAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">
      {initial}
    </span>
  );
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

    // Add up to 2 best
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

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-[clamp(20px,1.5vw,60px)]">
          <Trophy className="h-[clamp(18px,1.2vw,26px)] w-[clamp(18px,1.2vw,50px)] text-primary" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 overflow-y-auto min-h-0 flex-1">
        {sorted.length === 0 ? (
          <p className="text-muted-foreground text-center py-4 text-[clamp(14px,1vw,34px)]">
            No guesses yet. Be the first!
          </p>
        ) : (
          sorted.map((guess, index) => {
            const isFirstOccurrence = !seenPlayers.has(guess.player_name);
            seenPlayers.add(guess.player_name);

            return (
              <div
                key={guess.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50"
              >
                <div className="flex items-center justify-center w-6 shrink-0">
                  {getRankIcon(index + 1)}
                </div>

                <InitialAvatar name={guess.player_name} />

                {isFirstOccurrence ? (
                  <span className="font-medium text-[clamp(14px,1vw,18px)] break-all min-w-0">
                    {guess.player_name}
                  </span>
                ) : (
                  <span className="text-[clamp(12px,0.8vw,15px)] text-muted-foreground italic min-w-0 truncate">
                    try #{guess.guess_number ?? 1}
                  </span>
                )}

                <span className="text-[clamp(14px,1vw,18px)] font-mono text-accent font-semibold ml-auto shrink-0 whitespace-nowrap">
                  {formatScoreLabel(guess)}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
