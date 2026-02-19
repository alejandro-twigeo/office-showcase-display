import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, User } from 'lucide-react';

interface Guess {
  id: string;
  player_name: string;
  distance_km: number;
}

interface LeaderboardProps {
  guesses: Guess[];
}

export function Leaderboard({ guesses }: LeaderboardProps) {
  const bestGuesses = guesses.reduce((acc, guess) => {
    const existing = acc.find((g) => g.player_name === guess.player_name);
    if (!existing || guess.distance_km < existing.distance_km) {
      return [...acc.filter((g) => g.player_name !== guess.player_name), guess];
    }
    return acc;
  }, [] as Guess[]);

  const sorted = bestGuesses.sort((a, b) => a.distance_km - b.distance_km);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-warning" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-warning/60" />;
    return <span className="w-5 text-center text-sm text-muted-foreground">{rank}</span>;
  };

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
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
          sorted.map((guess, index) => (
            <div
              key={guess.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50"
            >
              <div className="flex items-center justify-center w-6">
                {getRankIcon(index + 1)}
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium truncate text-[clamp(14px,1vw,18px)]">{guess.player_name}</span>
              </div>
              <span className="text-[clamp(14px,1vw,18px)] font-mono text-accent font-semibold">
                {formatDistance(guess.distance_km)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
