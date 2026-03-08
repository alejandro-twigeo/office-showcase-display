import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRounds } from '@/hooks/useRounds';
import { useScoring, calculateWordleScore } from '@/hooks/useScoring';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';

export function WordleLeaderboard({ dashboard = false, progressBar }: { dashboard?: boolean; progressBar?: React.ReactNode }) {
  const { rounds } = useRounds();
  const { settings } = useScoring();
  const [selectedRoundIdx, setSelectedRoundIdx] = useState(0);

  const sortedRounds = useMemo(() =>
    [...rounds].sort((a, b) => b.round_number - a.round_number),
    [rounds]
  );
  const selectedRound = sortedRounds[selectedRoundIdx] ?? null;

  const { data: scores = [] } = useQuery({
    queryKey: ['wordle_leaderboard', selectedRound?.id],
    queryFn: async () => {
      if (!selectedRound?.id) return [];
      const { data } = await supabase
        .from('wordle_scores' as any)
        .select('*')
        .eq('round_id', selectedRound.id)
        .order('attempts', { ascending: true });
      return (data ?? []) as any[];
    },
    enabled: !!selectedRound?.id,
  });

  const { data: players } = useQuery({
    queryKey: ['players-avatars'],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('name, avatar');
      return data ?? [];
    },
  });
  const avatarMap = new Map(players?.map(p => [p.name, p.avatar]) ?? []);

  // Sort: solved first (by fewer attempts), then unsolved
  const sorted = [...scores].sort((a, b) => {
    if (a.solved && !b.solved) return -1;
    if (!a.solved && b.solved) return 1;
    return a.attempts - b.attempts;
  });

  const getRankIcon = (r: number) => {
    if (r === 1) return <Trophy className="h-5 w-5 text-warning" />;
    if (r === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (r === 3) return <Medal className="h-5 w-5 text-warning/60" />;
    return <span className="w-5 text-center text-sm text-muted-foreground">{r}</span>;
  };

  const canGoPrev = selectedRoundIdx < sortedRounds.length - 1;
  const canGoNext = selectedRoundIdx > 0;

  return (
    <Card className={dashboard ? "h-full min-h-0 flex flex-col" : ""}>
      <CardHeader className={dashboard ? "pb-1 pt-3 px-3 md:pb-3 md:pt-6 md:px-6" : "pb-1 pt-3 px-3"}>
        <CardTitle className={`flex items-center gap-1.5 ${dashboard ? "text-sm md:text-[clamp(20px,1.5vw,60px)]" : "text-sm"}`}>
          <Trophy className="h-4 w-4 md:h-[clamp(18px,1.2vw,26px)] md:w-[clamp(18px,1.2vw,50px)] text-primary" />
          Wordle Leaderboard
        </CardTitle>
        {sortedRounds.length > 0 && (
          <div className="flex items-center justify-between mt-1">
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => setSelectedRoundIdx(i => i + 1)} disabled={!canGoPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              Round {selectedRound?.round_number ?? '?'}
              {selectedRound?.is_active && ' (current)'}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => setSelectedRoundIdx(i => i - 1)} disabled={!canGoNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      {progressBar && <div className="px-3 md:px-6">{progressBar}</div>}
      <CardContent className={`space-y-1 ${dashboard ? "overflow-y-auto min-h-0 flex-1" : ""}`}>
        {sorted.length === 0 ? (
          <p className="text-muted-foreground text-center py-4 text-sm">
            No Wordle scores yet
          </p>
        ) : (
          sorted.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-center w-6 shrink-0">
                {entry.solved ? getRankIcon(i + 1) : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-lg shrink-0">{avatarMap.get(entry.player_name) ?? '👤'}</span>
                <span className="font-medium text-sm break-all">{entry.player_name}</span>
              </div>
              <div className="ml-auto shrink-0 text-right">
                {entry.solved ? (
                  <>
                    <span className="text-sm font-mono text-accent font-semibold">{calculateWordleScore(entry.attempts, settings)} pts</span>
                    <div className="text-xs text-muted-foreground">{entry.attempts}/6 tries</div>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">failed</span>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
