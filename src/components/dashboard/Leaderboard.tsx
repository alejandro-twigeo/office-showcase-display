import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Binoculars, Brain, ChevronLeft, ChevronRight } from 'lucide-react';
import { useScoring, calculateScore } from '@/hooks/useScoring';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRounds, type Round } from '@/hooks/useRounds';
import { useGuesses } from '@/hooks/useGuesses';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';

interface Guess {
  id: string;
  player_name: string;
  distance_km: number;
  guess_number?: number;
}

interface LeaderboardProps {
  /** If provided, uses these guesses directly (legacy/external usage) */
  easyGuesses?: Guess[];
  hardGuesses?: Guess[];
  /** Optional progress bar element rendered below header */
  progressBar?: React.ReactNode;
}

export function Leaderboard({ easyGuesses: externalEasyGuesses, hardGuesses: externalHardGuesses, progressBar }: LeaderboardProps) {
  const { settings } = useScoring();
  const { difficulty_weights } = settings;
  const { rounds } = useRounds();
  const [selectedRoundIdx, setSelectedRoundIdx] = useState(0); // 0 = current/latest

  // Determine which round to show
  const sortedRounds = useMemo(() => 
    [...rounds].sort((a, b) => b.round_number - a.round_number), 
    [rounds]
  );
  const selectedRound = sortedRounds[selectedRoundIdx] ?? null;

  // Fetch locations for selected round
  const { data: roundLocations } = useQuery({
    queryKey: ['round-locations', selectedRound?.id],
    queryFn: async () => {
      if (!selectedRound?.id) return [];
      const { data } = await supabase
        .from('locations')
        .select('id, difficulty, round_id')
        .eq('round_id', selectedRound.id);
      return data ?? [];
    },
    enabled: !!selectedRound?.id,
  });

  const easyLocationId = roundLocations?.find(l => l.difficulty === 1)?.id;
  const hardLocationId = roundLocations?.find(l => l.difficulty === 3)?.id;

  // Fetch guesses for round locations
  const { guesses: roundEasyGuesses } = useGuesses(easyLocationId);
  const { guesses: roundHardGuesses } = useGuesses(hardLocationId);

  // Use round-based guesses if we have rounds, otherwise fall back to external props
  const easyGuesses = sortedRounds.length > 0 ? roundEasyGuesses : (externalEasyGuesses ?? []);
  const hardGuesses = sortedRounds.length > 0 ? roundHardGuesses : (externalHardGuesses ?? []);

  const { data: players } = useQuery({
    queryKey: ['players-avatars'],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('name, avatar, office');
      return data ?? [];
    },
  });
  const avatarMap = new Map(players?.map(p => [p.name, p.avatar]) ?? []);

  const bestScore = (guesses: Guess[] | undefined) => {
    const byPlayer = new Map<string, { score: number; attempt: number }>();
    if (!guesses) return byPlayer;
    for (const g of guesses) {
      const score = calculateScore(g.distance_km, g.guess_number ?? 1, settings);
      const current = byPlayer.get(g.player_name);
      if (!current || score > current.score) {
        byPlayer.set(g.player_name, { score, attempt: g.guess_number ?? 1 });
      }
    }
    return byPlayer;
  };

  const easyScores = bestScore(easyGuesses);
  const hardScores = bestScore(hardGuesses);

  const allPlayers = new Set([...easyScores.keys(), ...hardScores.keys()]);

  const combined: { name: string; easy: number; easyAttempt: number; hard: number; hardAttempt: number; total: number }[] = [];
  for (const name of allPlayers) {
    const easyData = easyScores.get(name);
    const hardData = hardScores.get(name);
    const easy = easyData?.score ?? 0;
    const hard = hardData?.score ?? 0;
    const total = Math.round(easy * difficulty_weights.easy + hard * difficulty_weights.hard);
    combined.push({ name, easy, easyAttempt: easyData?.attempt ?? 0, hard, hardAttempt: hardData?.attempt ?? 0, total });
  }
  combined.sort((a, b) => b.total - a.total);

  const getRankIcon = (r: number) => {
    if (r === 1) return <Trophy className="h-5 w-5 text-warning" />;
    if (r === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (r === 3) return <Medal className="h-5 w-5 text-warning/60" />;
    return <span className="w-5 text-center text-sm text-muted-foreground">{r}</span>;
  };

  const canGoPrev = selectedRoundIdx < sortedRounds.length - 1;
  const canGoNext = selectedRoundIdx > 0;

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-1 pt-3 px-3 md:pb-3 md:pt-6 md:px-6">
        <CardTitle className="flex items-center gap-1.5 text-sm md:text-[clamp(20px,1.5vw,60px)]">
          <Trophy className="h-4 w-4 md:h-[clamp(18px,1.2vw,26px)] md:w-[clamp(18px,1.2vw,50px)] text-primary" />
          GeoGuessr Leaderboard
        </CardTitle>
        {sortedRounds.length > 0 && (
          <div className="flex items-center justify-between mt-1">
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => setSelectedRoundIdx(i => i + 1)}
              disabled={!canGoPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              Round {selectedRound?.round_number ?? '?'}
              {selectedRound?.is_active && ' (current)'}
            </span>
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => setSelectedRoundIdx(i => i - 1)}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
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
                <span className="text-lg shrink-0">{avatarMap.get(entry.name) ?? '👤'}</span>
                <span className="font-medium text-[clamp(14px,1vw,18px)] break-all">
                  {entry.name}
                </span>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <span className="text-[clamp(14px,1vw,18px)] font-mono text-accent font-semibold">
                  {entry.total} pts
                </span>
                <div className="flex items-center gap-1.5 text-[clamp(10px,0.7vw,12px)] text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    <Binoculars className="h-3 w-3 text-green-500" />{entry.easy}
                    {entry.easyAttempt > 0 && <span className="opacity-70">(#{entry.easyAttempt})</span>}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Brain className="h-3 w-3 text-red-500" />{entry.hard}
                    {entry.hardAttempt > 0 && <span className="opacity-70">(#{entry.hardAttempt})</span>}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
