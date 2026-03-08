import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMinigameLeaderboard, useMinigameDates, todayDate } from '@/hooks/useMinigameScore';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  gameId: string;
  title: string;
  emoji?: string;
  formatMeta?: (meta: Record<string, any>, score: number) => string;
  dashboard?: boolean;
  progressBar?: React.ReactNode;
}

export function MinigameLeaderboard({ gameId, title, emoji = '🏆', formatMeta, dashboard = false, progressBar }: Props) {
  const { data: dates = [] } = useMinigameDates(gameId);
  const [dateIdx, setDateIdx] = useState(0);

  const allDates = useMemo(() => {
    const today = todayDate();
    if (dates.length === 0) return [today];
    if (!dates.includes(today)) return [today, ...dates];
    return dates;
  }, [dates]);

  const selectedDate = allDates[dateIdx] ?? todayDate();
  const { data: scores = [] } = useMinigameLeaderboard(gameId, selectedDate);

  const { data: players } = useQuery({
    queryKey: ['players-avatars'],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('name, avatar');
      return data ?? [];
    },
  });
  const avatarMap = new Map(players?.map(p => [p.name, p.avatar]) ?? []);

  const canGoPrev = dateIdx < allDates.length - 1;
  const canGoNext = dateIdx > 0;

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
        <div className="flex items-center justify-between mt-1">
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setDateIdx(i => i + 1)} disabled={!canGoPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium text-muted-foreground">
            {selectedDate === todayDate() ? 'Today' : selectedDate}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setDateIdx(i => i - 1)} disabled={!canGoNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      {progressBar && <div className="px-3 md:px-6">{progressBar}</div>}
      <CardContent className={`space-y-1 ${dashboard ? "overflow-y-auto min-h-0 flex-1" : ""}`}>
        {scores.length === 0 ? (
          <p className="text-muted-foreground text-center py-4 text-sm">No scores yet</p>
        ) : (
          scores.map((entry, i) => (
            <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
              <div className="flex items-center justify-center w-6 shrink-0">
                {getRankIcon(i + 1)}
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-lg shrink-0">{avatarMap.get(entry.player_name) ?? '👤'}</span>
                <span className="font-medium text-sm break-all">{entry.player_name}</span>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <span className="text-sm font-mono text-accent font-semibold">{entry.score} pts</span>
                {formatMeta && (
                  <div className="text-xs text-muted-foreground">{formatMeta(entry.meta, entry.score)}</div>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
