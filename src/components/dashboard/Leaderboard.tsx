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

  // Group guesses by player
  const byPlayer = new Map<string, Guess[]>();
  for (const g of guesses) {
    byPlayer.set(g.player_name, [...(byPlayer.get(g.player_name) ?? []), g]);
  }

  // For each player pick ONE best guess id to show as a full row
  const fullRowId = new Map<string, string>(); // player_name → guess id

  for (const [player, playerGuesses] of byPlayer) {
    const firstTry = playerGuesses.find((g) => (g.guess_number ?? 1) === 1);
    const sortedByDist = [...playerGuesses].sort((a, b) => a.distance_km - b.distance_km);

    const candidates = new Map<string, Guess>();
    if (firstTry) candidates.set(firstTry.id, firstTry);
    for (const g of sortedByDist) {
      if (candidates.size >= 3) break;
      if (!candidates.has(g.id)) candidates.set(g.id, g);
    }

    const best = [...candidates.values()].sort((a, b) => a.distance_km - b.distance_km)[0];
    if (best) fullRowId.set(player, best.id);
  }

  // Sort ALL guesses by distance ascending
  const allSorted = [...guesses].sort((a, b) => a.distance_km - b.distance_km);

  // Build render list: full rows + initial-circle groups for extras
  type RowItem = { type: 'row'; guess: Guess; rank: number };
  type DotItem = { type: 'dots'; initials: string[] };
  type RenderItem = RowItem | DotItem;

  const renderItems: RenderItem[] = [];
  const renderedPlayers = new Set<string>();
  let rank = 0;

  for (const guess of allSorted) {
    const isFullRow =
      fullRowId.get(guess.player_name) === guess.id &&
      !renderedPlayers.has(guess.player_name);

    if (isFullRow) {
      rank++;
      renderedPlayers.add(guess.player_name);
      renderItems.push({ type: 'row', guess, rank });
    } else {
      const initial = guess.player_name.trim().charAt(0).toUpperCase();
      const last = renderItems[renderItems.length - 1];
      if (last?.type === 'dots') {
        last.initials.push(initial);
      } else {
        renderItems.push({ type: 'dots', initials: [initial] });
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
                    {(item.guess.guess_number ?? 1) > 1 && (
                      <span className="text-[clamp(10px,0.7vw,13px)] text-muted-foreground shrink-0">
                        #{item.guess.guess_number}
                      </span>
                    )}
                  </div>
                  <span className="text-[clamp(14px,1vw,18px)] font-mono text-accent font-semibold ml-auto shrink-0 whitespace-nowrap">
                    {formatScoreLabel(item.guess)}
                  </span>
                </div>
              );
            }

            // Initial-circle row — replaces the hidden guesses
            return (
              <div
                key={`dots-${i}`}
                className="flex items-center justify-center gap-1 py-0.5 px-2"
              >
                {item.initials.map((initial, di) => (
                  <span
                    key={di}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground border border-border"
                    style={{ fontSize: '9px', fontWeight: 600 }}
                  >
                    {initial}
                  </span>
                ))}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
