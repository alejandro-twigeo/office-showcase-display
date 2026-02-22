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
  easyGuesses: Guess[];
  hardGuesses: Guess[];
}

export function Leaderboard({ easyGuesses, hardGuesses }: LeaderboardProps) {
  const { settings } = useScoring();
  const { difficulty_weights } = settings;

  // Best score per player per difficulty
  const bestScore = (guesses: Guess[] | undefined) => {
    const byPlayer = new Map<string, number>();
    if (!guesses) return byPlayer;
    for (const g of guesses) {
      const score = calculateScore(g.distance_km, g.guess_number ?? 1, settings);
      const current = byPlayer.get(g.player_name) ?? 0;
      if (score > current) byPlayer.set(g.player_name, score);
    }
    return byPlayer;
  };

  const easyScores = bestScore(easyGuesses);
  const hardScores = bestScore(hardGuesses);

  // All players who played either
  const allPlayers = new Set([...easyScores.keys(), ...hardScores.keys()]);

  // Combined scores
  const combined: { name: string; easy: number; hard: number; total: number }[] = [];
  for (const name of allPlayers) {
    const easy = easyScores.get(name) ?? 0;
    const hard = hardScores.get(name) ?? 0;
    const total = Math.round(easy * difficulty_weights.easy + hard * difficulty_weights.hard);
    combined.push({ name, easy, hard, total });
  }
  combined.sort((a, b) => b.total - a.total);

  const getRankIcon = (r: number) => {
    if (r === 1) return <Trophy className="h-5 w-5 text-warning" />;
    if (r === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (r === 3) return <Medal className="h-5 w-5 text-warning/60" />;
    return <span className="w-5 text-center text-sm text-muted-foreground">{r}</span>;
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
        {combined.length === 0 ? (
          <p className="text-muted-foreground text-center py-4 text-[clamp(14px,1vw,34px)]">
            No guesses yet. Be the first!
          </p>
        ) : (
          combined.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-center w-6 shrink-0">
                {getRankIcon(i + 1)}
              </div>
              <div className="flex items-center gap-1 shrink-0 min-w-0">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-[clamp(14px,1vw,18px)] break-all">
                  {entry.name}
                </span>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <span className="text-[clamp(14px,1vw,18px)] font-mono text-accent font-semibold">
                  {entry.total} pts
                </span>
                <div className="text-[clamp(10px,0.7vw,12px)] text-muted-foreground">
                  🟢{entry.easy} · 🔴{entry.hard}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
