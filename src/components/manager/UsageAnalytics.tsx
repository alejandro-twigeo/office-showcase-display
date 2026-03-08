import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, TrendingUp, Gamepad2 } from 'lucide-react';

interface DayStat {
  date: string;
  uniqueVisitors: number;
  totalVisits: number;
}

interface GameStat {
  game_id: string;
  avgPlayersPerDay: number;
}

export function UsageAnalytics() {
  const [dayStats, setDayStats] = useState<DayStat[]>([]);
  const [gameStats, setGameStats] = useState<GameStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch visit logs for last 14 days
      const since = new Date();
      since.setDate(since.getDate() - 13);
      since.setHours(0, 0, 0, 0);

      const { data: visits } = await (supabase as any)
        .from('visit_logs')
        .select('device_id, visited_at')
        .gte('visited_at', since.toISOString())
        .order('visited_at', { ascending: false });

      // Group by date
      const byDate = new Map<string, Set<string>>();
      const countByDate = new Map<string, number>();
      for (const v of (visits || [])) {
        const d = v.visited_at.slice(0, 10);
        if (!byDate.has(d)) byDate.set(d, new Set());
        byDate.get(d)!.add(v.device_id);
        countByDate.set(d, (countByDate.get(d) || 0) + 1);
      }

      const stats: DayStat[] = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        stats.push({
          date: key,
          uniqueVisitors: byDate.get(key)?.size || 0,
          totalVisits: countByDate.get(key) || 0,
        });
      }
      setDayStats(stats);

      // Fetch game stats (minigame_scores + wordle_scores) for last 14 days
      const { data: minigameData } = await supabase
        .from('minigame_scores')
        .select('game_id, device_id, date')
        .gte('date', since.toISOString().slice(0, 10));

      const { data: wordleData } = await supabase
        .from('wordle_scores')
        .select('device_id, created_at')
        .gte('created_at', since.toISOString());

      // Group minigame by game_id -> date -> unique devices
      const gameByDay = new Map<string, Map<string, Set<string>>>();
      for (const s of (minigameData || [])) {
        if (!gameByDay.has(s.game_id)) gameByDay.set(s.game_id, new Map());
        const dateMap = gameByDay.get(s.game_id)!;
        if (!dateMap.has(s.date)) dateMap.set(s.date, new Set());
        dateMap.get(s.date)!.add(s.device_id);
      }

      // Add wordle as a game
      const wordleDays = new Map<string, Set<string>>();
      for (const w of (wordleData || [])) {
        const d = w.created_at.slice(0, 10);
        if (!wordleDays.has(d)) wordleDays.set(d, new Set());
        wordleDays.get(d)!.add(w.device_id);
      }
      if (wordleDays.size > 0) gameByDay.set('wordle', wordleDays);

      // Also count geoguessr from guesses table
      const { data: guessData } = await supabase
        .from('guesses')
        .select('device_id, created_at')
        .gte('created_at', since.toISOString());

      const geoDays = new Map<string, Set<string>>();
      for (const g of (guessData || [])) {
        const d = (g.created_at || '').slice(0, 10);
        if (!d) continue;
        if (!geoDays.has(d)) geoDays.set(d, new Set());
        geoDays.get(d)!.add(g.device_id);
      }
      if (geoDays.size > 0) gameByDay.set('geoguessr', geoDays);

      const gStats: GameStat[] = [];
      for (const [gameId, dateMap] of gameByDay) {
        const daysWithPlay = dateMap.size;
        let totalPlayers = 0;
        for (const devices of dateMap.values()) totalPlayers += devices.size;
        gStats.push({
          game_id: gameId,
          avgPlayersPerDay: daysWithPlay > 0 ? Math.round((totalPlayers / daysWithPlay) * 10) / 10 : 0,
        });
      }
      gStats.sort((a, b) => b.avgPlayersPerDay - a.avgPlayersPerDay);
      setGameStats(gStats);
    } catch (e) {
      console.error('Failed to fetch usage stats', e);
    } finally {
      setLoading(false);
    }
  };

  const GAME_LABELS: Record<string, string> = {
    geoguessr: '📍 GeoGuessr',
    wordle: '🟩 Wordle',
    city_guess: '🏙️ City Guess',
    this_or_that: '⚖️ This or That',
    sudoku: '🔢 Sudoku',
    pairs: '🃏 Pairs',
    labyrinth: '🌀 Labyrinth',
  };

  // Summary stats
  const today = dayStats[dayStats.length - 1];
  const daysWithVisitors = dayStats.filter(d => d.uniqueVisitors > 0);
  const avgVisitorsPerDay = daysWithVisitors.length > 0
    ? Math.round(daysWithVisitors.reduce((s, d) => s + d.uniqueVisitors, 0) / daysWithVisitors.length * 10) / 10
    : 0;
  const avgVisitsPerPerson = daysWithVisitors.length > 0
    ? Math.round(
        daysWithVisitors.reduce((s, d) => s + (d.uniqueVisitors > 0 ? d.totalVisits / d.uniqueVisitors : 0), 0)
        / daysWithVisitors.length * 10
      ) / 10
    : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Usage Analytics</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground">Loading...</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Usage Analytics</CardTitle>
        <p className="text-xs text-muted-foreground">Last 14 days</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border bg-secondary/30 p-2 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{today?.uniqueVisitors ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Today</p>
          </div>
          <div className="rounded-lg border bg-secondary/30 p-2 text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{avgVisitorsPerDay}</p>
            <p className="text-[10px] text-muted-foreground">Avg/day</p>
          </div>
          <div className="rounded-lg border bg-secondary/30 p-2 text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{avgVisitsPerPerson}×</p>
            <p className="text-[10px] text-muted-foreground">Visits/person</p>
          </div>
        </div>

        {/* Daily chart (simple bar) */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Daily Unique Visitors</p>
          <div className="flex items-end gap-[3px] h-16">
            {dayStats.map((d) => {
              const maxV = Math.max(...dayStats.map(s => s.uniqueVisitors), 1);
              const h = d.uniqueVisitors > 0 ? Math.max((d.uniqueVisitors / maxV) * 100, 8) : 0;
              const isToday = d.date === new Date().toISOString().slice(0, 10);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.uniqueVisitors} visitors, ${d.totalVisits} visits`}>
                  <div
                    className={`w-full rounded-sm ${isToday ? 'bg-primary' : 'bg-primary/40'}`}
                    style={{ height: `${h}%`, minHeight: d.uniqueVisitors > 0 ? 4 : 0 }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-[3px] mt-0.5">
            {dayStats.map((d) => (
              <div key={d.date} className="flex-1 text-center">
                <span className="text-[8px] text-muted-foreground">
                  {new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Game popularity */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
            <Gamepad2 className="h-3 w-3 inline mr-1" />
            Avg Players/Day per Game
          </p>
          {gameStats.length === 0 ? (
            <p className="text-xs text-muted-foreground">No game data yet</p>
          ) : (
            <div className="space-y-1">
              {gameStats.map((g) => {
                const maxP = Math.max(...gameStats.map(s => s.avgPlayersPerDay), 1);
                return (
                  <div key={g.game_id} className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate">{GAME_LABELS[g.game_id] || g.game_id}</span>
                    <div className="flex-1 h-3 rounded-full bg-secondary/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${(g.avgPlayersPerDay / maxP) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{g.avgPlayersPerDay}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
