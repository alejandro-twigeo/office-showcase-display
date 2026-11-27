import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { Users, TrendingUp, Gamepad2, CalendarIcon, UserCheck, UserMinus, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayStat {
  date: string;
  uniqueVisitors: number;
  totalVisits: number;
  playerNames: string[];
}

/** One person in the People list */
interface PersonRow {
  name: string;
  avatar: string;
  detail: string;
  days: number;
  games: number;
  lastSeen: string | null;
}

interface GameStat {
  game_id: string;
  avgPlayersPerDay: number;
}

export function UsageAnalytics() {
  const [dayStats, setDayStats] = useState<DayStat[]>([]);
  const [gameStats, setGameStats] = useState<GameStat[]>([]);
  const [totalDailyUniques, setTotalDailyUniques] = useState(0);
  const [distinctPersons, setDistinctPersons] = useState(0);
  const [loading, setLoading] = useState(true);
  // Who came, who didn't, and who never signed up
  const [active, setActive] = useState<PersonRow[]>([]);
  const [notSeen, setNotSeen] = useState<PersonRow[]>([]);
  const [neverJoined, setNeverJoined] = useState<PersonRow[]>([]);
  const [rosterOk, setRosterOk] = useState(true);

  const [fromDate, setFromDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [toDate, setToDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  useEffect(() => {
    fetchStats();
  }, [fromDate, toDate]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Use date strings for date-column queries, and wide UTC range for timestamp queries
      const fromStr = format(fromDate, 'yyyy-MM-dd');
      const toStr = format(toDate, 'yyyy-MM-dd');
      // For timestamp columns, use a wide range to cover all timezones
      const sinceStr = fromStr + 'T00:00:00.000Z';
      const untilStr = toStr + 'T23:59:59.999Z';

      // Fetch visit logs + game activity in parallel to build complete visitor picture
      const [{ data: visits }, { data: minigameData }, { data: wordleData }, { data: guessData }] = await Promise.all([
        (supabase as any)
          .from('visit_logs')
          .select('player_name, visited_at')
          .not('player_name', 'is', null)
          .gte('visited_at', sinceStr)
          .lte('visited_at', untilStr),
        supabase
          .from('minigame_scores')
          .select('game_id, player_name, date')
          .gte('date', fromStr)
          .lte('date', toStr),
        supabase
          .from('wordle_scores')
          .select('player_name, created_at')
          .gte('created_at', sinceStr)
          .lte('created_at', untilStr),
        supabase
          .from('guesses')
          .select('player_name, created_at')
          .gte('created_at', sinceStr)
          .lte('created_at', untilStr),
      ]);

      // Build visitor map from visit_logs
      const byDate = new Map<string, Set<string>>();
      const allUsers = new Set<string>();
      const daysByPerson = new Map<string, Set<string>>();
      const addVisitor = (name: string, date: string) => {
        if (!name || !date) return;
        if (!byDate.has(date)) byDate.set(date, new Set());
        byDate.get(date)!.add(name);
        allUsers.add(name);
        if (!daysByPerson.has(name)) daysByPerson.set(name, new Set());
        daysByPerson.get(name)!.add(date);
      };

      for (const v of (visits || [])) {
        if (v.player_name) addVisitor(v.player_name, v.visited_at.slice(0, 10));
      }
      // Challenges are stored as "from>to>game", not as a person playing: leave them out
      const plays = (minigameData || []).filter((s) => s.game_id !== 'challenge');
      for (const s of plays) addVisitor(s.player_name, s.date);
      for (const w of (wordleData || [])) addVisitor(w.player_name, (w.created_at || '').slice(0, 10));
      for (const g of (guessData || [])) addVisitor(g.player_name, (g.created_at || '').slice(0, 10));

      // Games per person: minigame scores (not challenges), Wordle, and one GeoGuessr game per day
      const gamesByPerson = new Map<string, number>();
      const addGame = (name: string) => name && gamesByPerson.set(name, (gamesByPerson.get(name) ?? 0) + 1);
      for (const s of plays) addGame(s.player_name);
      for (const w of (wordleData || [])) addGame(w.player_name);
      const geoDayKeys = new Set((guessData || []).map((g) => `${g.player_name}|${(g.created_at || '').slice(0, 10)}`));
      for (const k of geoDayKeys) addGame(k.split('|')[0]);

      // Everyone with a profile, and the team list (admin only; empty if the step isn't run yet)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const [{ data: players }, roster] = await Promise.all([
        db.from('players').select('name, avatar, office, department'),
        db.rpc('admin_roster'),
      ]);
      setRosterOk(!roster.error);
      const OFFICE: Record<string, string> = { Sweden: 'Stockholm', US: 'New York', Bulgaria: 'Varna' };
      const rowFor = (p: { name: string; avatar?: string | null; office?: string | null; department?: string | null }): PersonRow => {
        const days = daysByPerson.get(p.name);
        return {
          name: p.name,
          avatar: p.avatar ?? '👤',
          detail: [p.department, p.office ? OFFICE[p.office] ?? p.office : null].filter(Boolean).join(' · '),
          days: days?.size ?? 0,
          games: gamesByPerson.get(p.name) ?? 0,
          lastSeen: days ? [...days].sort().at(-1) ?? null : null,
        };
      };
      const everyone = ((players ?? []) as { name: string; avatar: string | null; office: string | null; department: string | null }[]).map(rowFor);
      setActive(everyone.filter((r) => r.days > 0).sort((a, b) => b.days - a.days || b.games - a.games || a.name.localeCompare(b.name)));
      setNotSeen(everyone.filter((r) => r.days === 0).sort((a, b) => a.name.localeCompare(b.name)));
      setNeverJoined(
        ((roster.data ?? []) as { full_name: string; department: string; office: string | null; player_name: string | null }[])
          .filter((r) => !r.player_name)
          .map((r) => ({
            name: r.full_name,
            avatar: '·',
            detail: [r.department, r.office ? OFFICE[r.office] ?? r.office : null].filter(Boolean).join(' · '),
            days: 0,
            games: 0,
            lastSeen: null,
          }))
      );

      const dayCount = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const stats: DayStat[] = [];
      for (let i = 0; i < dayCount; i++) {
        const d = new Date(fromDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        const uniqueCount = byDate.get(key)?.size || 0;
        stats.push({
          date: key,
          uniqueVisitors: uniqueCount,
          totalVisits: uniqueCount,
          playerNames: [...(byDate.get(key) ?? [])].sort((a, b) => a.localeCompare(b)),
        });
      }
      setDayStats(stats);

      const sumDailyUniques = stats.reduce((sum, d) => sum + d.uniqueVisitors, 0);
      setTotalDailyUniques(sumDailyUniques);
      setDistinctPersons(allUsers.size);

      // Build game stats from already-fetched data using player_name
      const gameByDay = new Map<string, Map<string, Set<string>>>();
      for (const s of plays) {
        if (!gameByDay.has(s.game_id)) gameByDay.set(s.game_id, new Map());
        const dateMap = gameByDay.get(s.game_id)!;
        if (!dateMap.has(s.date)) dateMap.set(s.date, new Set());
        dateMap.get(s.date)!.add(s.player_name);
      }

      const wordleDays = new Map<string, Set<string>>();
      for (const w of (wordleData || [])) {
        const d = w.created_at.slice(0, 10);
        if (!wordleDays.has(d)) wordleDays.set(d, new Set());
        wordleDays.get(d)!.add(w.player_name);
      }
      if (wordleDays.size > 0) gameByDay.set('wordle', wordleDays);

      const geoDays = new Map<string, Set<string>>();
      for (const g of (guessData || [])) {
        const d = (g.created_at || '').slice(0, 10);
        if (!d) continue;
        if (!geoDays.has(d)) geoDays.set(d, new Set());
        geoDays.get(d)!.add(g.player_name);
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
    color_memory: '🎨 Color Memory',
    this_or_that: '⚖️ This or That',
    sudoku: '🔢 Sudoku',
    pairs: '🃏 Pairs',
    labyrinth: '🌀 Zip',
    riddle: '🧩 Riddle',
    team_riddle: '🧠 Team riddle',
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const daysWithData = dayStats.filter(d => d.uniqueVisitors > 0).length || 1;
  const avgVisitorsPerDay = Math.round(totalDailyUniques / daysWithData * 10) / 10;
  const avgVisitsPerPerson = distinctPersons > 0
    ? Math.round((totalDailyUniques / distinctPersons) * 10) / 10
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Usage Analytics</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-7 text-xs gap-1", !fromDate && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3" />
                {format(fromDate, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                weekStartsOn={1}
                selected={fromDate}
                onSelect={(d) => d && setFromDate(d)}
                disabled={(d) => d > toDate || d > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-7 text-xs gap-1", !toDate && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3" />
                {format(toDate, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                weekStartsOn={1}
                selected={toDate}
                onSelect={(d) => d && setToDate(d)}
                disabled={(d) => d < fromDate || d > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border bg-secondary/30 p-2 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{totalDailyUniques}</p>
                <p className="text-[10px] text-muted-foreground">Total visitors</p>
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

            {/* Daily chart */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Daily Unique Visitors</p>
              <div className="flex items-end gap-[3px] h-16">
                {dayStats.map((d) => {
                  const maxV = Math.max(...dayStats.map(s => s.uniqueVisitors), 1);
                  const barPx = d.uniqueVisitors > 0 ? Math.max(Math.round((d.uniqueVisitors / maxV) * 64), 4) : 0;
                  const isToday = d.date === todayStr;
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-end justify-end"
                      title={
                        d.playerNames.length > 0
                          ? `${d.date}: ${d.uniqueVisitors} visitors\n${d.playerNames.join('\n')}`
                          : `${d.date}: No visitors`
                      }
                    >
                      {d.uniqueVisitors > 0 && (
                        <span className="text-[7px] text-muted-foreground text-center w-full leading-none mb-0.5">{d.uniqueVisitors}</span>
                      )}
                      <div
                        className={`w-full rounded-sm ${isToday ? 'bg-primary' : 'bg-primary/40'}`}
                        style={{ height: `${barPx}px` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-[3px] mt-0.5">
                {dayStats.map((d) => (
                  <div key={d.date} className="flex-1 text-center">
                    <span className="text-[8px] text-muted-foreground">
                      {new Date(d.date + 'T12:00:00').getDate()}/{new Date(d.date + 'T12:00:00').getMonth() + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* People: who came in this period, who didn't, who never signed up */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">People</p>
              <PeopleGroup
                icon={<UserCheck className="h-3.5 w-3.5 text-green-600" />}
                title={`Active in this period (${active.length})`}
                rows={active}
                right={(r) => (
                  <span className="tabular-nums">
                    {r.days} {r.days === 1 ? 'day' : 'days'} · {r.games} {r.games === 1 ? 'game' : 'games'}
                    <span className="text-muted-foreground"> · last {r.lastSeen ? format(new Date(r.lastSeen + 'T12:00:00'), 'd/M') : '–'}</span>
                  </span>
                )}
              />
              <PeopleGroup
                icon={<UserMinus className="h-3.5 w-3.5 text-amber-600" />}
                title={`Signed up, not seen in this period (${notSeen.length})`}
                rows={notSeen}
              />
              {rosterOk ? (
                <PeopleGroup
                  icon={<UserX className="h-3.5 w-3.5 text-muted-foreground" />}
                  title={`On the team list, never signed up (${neverJoined.length})`}
                  rows={neverJoined}
                  muted
                />
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  To see who never signed up, run <code>docs/sql/05_admin_roster.sql</code> in Lovable.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                A day counts when someone opened the Play page while logged in, or played a game. Opening the page was only
                logged from 27 Nov; before that, only games count.
              </p>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** A small labelled list of people */
function PeopleGroup({
  icon,
  title,
  rows,
  right,
  muted = false,
}: {
  icon: React.ReactNode;
  title: string;
  rows: PersonRow[];
  right?: (r: PersonRow) => React.ReactNode;
  muted?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {title}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        {icon} {title}
      </p>
      <div className="divide-y rounded-lg border">
        {rows.map((r) => (
          <div key={r.name} className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${muted ? 'text-muted-foreground' : ''}`}>
            <span className="w-5 text-center text-base leading-none">{r.avatar}</span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{r.name}</span>
              {r.detail && <span className="ml-1.5 text-muted-foreground">{r.detail}</span>}
            </span>
            {right && <span className="shrink-0 text-right">{right(r)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
