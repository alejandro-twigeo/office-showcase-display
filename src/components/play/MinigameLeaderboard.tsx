import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateFromIso, useMinigameLeaderboardRound, todayDate } from '@/hooks/useMinigameScore';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLeaderboardPlayerCount } from '@/hooks/useGameIcons';
import { useRounds } from '@/hooks/useRounds';

interface Props {
  gameId: string;
  title: string;
  emoji?: string;
  formatMeta?: (meta: Record<string, any>, score: number) => string;
  dashboard?: boolean;
  progressBar?: React.ReactNode;
}

export function MinigameLeaderboard({ gameId, title, emoji = '🏆', formatMeta, dashboard = false, progressBar }: Props) {
  const { rounds } = useRounds();
  const { data: leaderboardPlayerCount = 3 } = useLeaderboardPlayerCount();
  const [roundIdx, setRoundIdx] = useState(0);

  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => {
      if (b.round_number !== a.round_number) return b.round_number - a.round_number;
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    }),
    [rounds]
  );

  const selectedRound = sortedRounds[roundIdx] ?? null;
  const { data: scores = [] } = useMinigameLeaderboardRound(gameId, selectedRound?.id);

  const { data: players } = useQuery({
    queryKey: ['players-avatars'],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('name, avatar');
      return data ?? [];
    },
  });
  const avatarMap = new Map(players?.map(p => [p.name, p.avatar]) ?? []);

  const canGoPrev = roundIdx < sortedRounds.length - 1;
  const canGoNext = roundIdx > 0;
  const visibleScores = scores.slice(0, leaderboardPlayerCount);

  const label = useMemo(() => {
    if (!selectedRound) return 'Today';
    const roundDate = dateFromIso(selectedRound.created_at);
    const today = todayDate();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const prefix = roundDate === today ? 'Today' : roundDate === yesterday ? 'Yesterday' : roundDate;
    return `${prefix} · Round ${selectedRound.round_number}`;
  }, [selectedRound]);

  const getRankIcon = (r: number) => {
    if (r === 1) return <Trophy className="h-5 w-5 text-warning" />;
    if (r === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (r === 3) return <Medal className="h-5 w-5 text-warning/60" />;
    return <span className="w-5 text-center text-sm text-muted-foreground">{r}</span>;
  };

  return (
    <Card className={dashboard ? "h-full min-h-0 flex flex-col" : ""}>
      <CardHeader className={dashboard ? "pb-1 pt-3 px-3 md:pb-3 md:pt-6 md:px-6" : "pb-1 pt-3 px-3"}>
        <CardTitle className={`flex items-center gap-1.5 ${dashboard ? "text-sm md:text-[clamp(20px,1.5vw,60px)]" : "text-sm"}`}>
          <Trophy className="h-4 w-4 md:h-[clamp(18px,1.2vw,26px)] md:w-[clamp(18px,1.2vw,50px)] text-primary" />
          {emoji} {title} Leaderboard
        </CardTitle>
        {!dashboard && (
          <div className="flex items-center justify-between mt-1">
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => setRoundIdx(i => i + 1)} disabled={!canGoPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => setRoundIdx(i => i - 1)} disabled={!canGoNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      {progressBar && <div className="px-3 md:px-6">{progressBar}</div>}
      <CardContent className={`space-y-1 ${dashboard ? "overflow-y-auto min-h-0 flex-1" : ""}`}>
        {visibleScores.length === 0 ? (
          <p className="text-muted-foreground text-center py-4 text-sm">No scores yet</p>
        ) : (
          visibleScores.map((entry, i) => (
            <div key={entry.id} className={`flex items-center gap-1.5 rounded-md bg-secondary/50 ${dashboard ? 'py-1 px-1.5' : 'p-2'}`}>
              <div className="flex items-center justify-center w-5 shrink-0">
                {getRankIcon(i + 1)}
              </div>
              <span className={`${dashboard ? 'text-base' : 'text-lg'} shrink-0`}>{avatarMap.get(entry.player_name) ?? '👤'}</span>
              <span className={`font-medium truncate min-w-0 ${dashboard ? 'text-[clamp(12px,0.9vw,16px)]' : 'text-sm'}`}>{entry.player_name}</span>
              <div className="ml-auto shrink-0 text-right leading-tight">
                <span className={`font-mono text-accent font-semibold ${dashboard ? 'text-[clamp(12px,0.9vw,16px)]' : 'text-sm'}`}>{entry.score} pts</span>
                {formatMeta && (
                  <div className={`text-muted-foreground ${dashboard ? 'text-[clamp(9px,0.6vw,11px)]' : 'text-xs'}`}>{formatMeta(entry.meta, entry.score)}</div>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
