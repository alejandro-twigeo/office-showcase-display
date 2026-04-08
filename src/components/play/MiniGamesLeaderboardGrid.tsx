import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, ChevronLeft, ChevronRight } from 'lucide-react';
import { todayDate } from '@/hooks/useMinigameScore';
import { MINI_GAMES } from './miniGamesList';
import { calculateScore, calculateWordleScore, useScoring } from '@/hooks/useScoring';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLeaderboardPlayerCount } from '@/hooks/useGameIcons';

interface TopPlayer {
  player_name: string;
  score: number;
  avatar: string;
}

interface GeoGuess {
  player_name: string;
  distance_km: number;
  guess_number: number | null;
}

interface WordlePlayer extends TopPlayer {
  solved: boolean;
  attempts: number;
}

const GAME_LABELS: Record<string, { emoji: string; name: string }> = {};
for (const g of MINI_GAMES) {
  GAME_LABELS[g.id] = { emoji: g.emoji, name: g.name };
}
// Add wordle/geoguessr which aren't in MINI_GAMES list but may have scores
GAME_LABELS['wordle'] = GAME_LABELS['wordle'] || { emoji: '🟩', name: 'Wordle' };
GAME_LABELS['geoguessr'] = { emoji: '📍', name: 'GeoGuessr' };

function useAllLeaderboardDates() {
  return useQuery({
    queryKey: ['all-game-leaderboard-dates'],
    queryFn: async () => {
      const [{ data: minigameDates }, { data: wordleDates }, { data: guessDates }] = await Promise.all([
        supabase.from('minigame_scores').select('date'),
        supabase.from('wordle_scores').select('created_at'),
        supabase.from('guesses').select('created_at'),
      ]);

      const allDates = new Set<string>();
      for (const row of minigameDates ?? []) {
        if ((row as any).date) allDates.add((row as any).date);
      }
      for (const row of wordleDates ?? []) {
        if ((row as any).created_at) allDates.add(String((row as any).created_at).slice(0, 10));
      }
      for (const row of guessDates ?? []) {
        if ((row as any).created_at) allDates.add(String((row as any).created_at).slice(0, 10));
      }

      allDates.add(todayDate());
      return [...allDates].sort((a, b) => b.localeCompare(a));
    },
    refetchInterval: 30000,
  });
}

function usePlayersAllGames(selectedDate: string, distanceSettings: ReturnType<typeof useScoring>['settings']) {
  return useQuery({
    queryKey: [
      'all-game-leaderboards',
      selectedDate,
      distanceSettings.distance_parameter,
      JSON.stringify(distanceSettings.attempt_multipliers),
      JSON.stringify(distanceSettings.difficulty_weights),
    ],
    queryFn: async () => {
      const dateStart = `${selectedDate}T00:00:00.000Z`;
      const dateEnd = `${selectedDate}T23:59:59.999Z`;

      const [{ data: scores }, { data: rounds }] = await Promise.all([
        supabase
          .from('minigame_scores')
          .select('game_id, player_name, score')
          .eq('date', selectedDate)
          .order('score', { ascending: false }),
        supabase
          .from('rounds')
          .select('id, round_number, is_active, created_at')
          .gte('created_at', dateStart)
          .lte('created_at', dateEnd),
      ]);

      // Fetch avatars
      const { data: players } = await supabase.from('players').select('name, avatar');
      const avatarMap = new Map(players?.map(p => [p.name, p.avatar]) ?? []);

      // Group by game, all players
      const byGame = new Map<string, TopPlayer[]>();

      for (const s of (scores ?? [])) {
        if (!byGame.has(s.game_id)) byGame.set(s.game_id, []);
        const list = byGame.get(s.game_id)!;
        list.push({
          player_name: s.player_name,
          score: s.score,
          avatar: avatarMap.get(s.player_name) ?? '👤',
        });
      }

      const sortedRounds = [...(rounds ?? [])].sort((a, b) => {
        if ((b.round_number ?? 0) !== (a.round_number ?? 0)) {
          return (b.round_number ?? 0) - (a.round_number ?? 0);
        }
        return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
      });

      const selectedRound = selectedDate === todayDate()
        ? sortedRounds.find((round) => round.is_active) ?? sortedRounds[0]
        : sortedRounds[0];

      if (selectedRound?.id) {
        const { data: wordleScores } = await supabase
          .from('wordle_scores')
          .select('player_name, attempts, solved')
          .eq('round_id', selectedRound.id)
          .order('attempts', { ascending: true });

        if ((wordleScores ?? []).length > 0) {
          const wordlePlayers: WordlePlayer[] = [...(wordleScores ?? [])]
            .map((entry) => ({
              player_name: entry.player_name,
              score: entry.solved ? calculateWordleScore(entry.attempts, distanceSettings) : 0,
              avatar: avatarMap.get(entry.player_name) ?? '👤',
              solved: entry.solved,
              attempts: entry.attempts,
            }))
            .sort((a, b) => {
              if (a.solved && !b.solved) return -1;
              if (!a.solved && b.solved) return 1;
              return a.attempts - b.attempts;
            });

          byGame.set('wordle', wordlePlayers);
        }

        const { data: roundLocations } = await supabase
          .from('locations')
          .select('id, difficulty')
          .eq('round_id', selectedRound.id);

        const easyLocationId = roundLocations?.find((location) => location.difficulty === 1)?.id;
        const hardLocationId = roundLocations?.find((location) => location.difficulty === 3)?.id;

        const [{ data: easyGuesses }, { data: hardGuesses }] = await Promise.all([
          easyLocationId
            ? supabase
                .from('guesses')
                .select('player_name, distance_km, guess_number')
                .eq('location_id', easyLocationId)
            : Promise.resolve({ data: [] as GeoGuess[] }),
          hardLocationId
            ? supabase
                .from('guesses')
                .select('player_name, distance_km, guess_number')
                .eq('location_id', hardLocationId)
            : Promise.resolve({ data: [] as GeoGuess[] }),
        ]);

        const bestScore = (guesses: GeoGuess[] | null | undefined) => {
          const byPlayer = new Map<string, number>();
          for (const guess of guesses ?? []) {
            const score = calculateScore(guess.distance_km, guess.guess_number ?? 1, distanceSettings);
            const current = byPlayer.get(guess.player_name);
            if (current == null || score > current) {
              byPlayer.set(guess.player_name, score);
            }
          }
          return byPlayer;
        };

        const easyScores = bestScore(easyGuesses);
        const hardScores = bestScore(hardGuesses);
        const playerNames = new Set([...easyScores.keys(), ...hardScores.keys()]);

        const geoPlayers = [...playerNames]
          .map((name) => {
            const easy = easyScores.get(name) ?? 0;
            const hard = hardScores.get(name) ?? 0;
            return {
              player_name: name,
              score: Math.round(
                easy * distanceSettings.difficulty_weights.easy +
                hard * distanceSettings.difficulty_weights.hard
              ),
              avatar: avatarMap.get(name) ?? '👤',
            };
          })
          .sort((a, b) => b.score - a.score);

        if (geoPlayers.length > 0) {
          byGame.set('geoguessr', geoPlayers);
        }
      }

      return byGame;
    },
    refetchInterval: 30000,
  });
}

const RANK_COLORS = [
  'text-yellow-500',
  'text-muted-foreground',
  'text-amber-600/70',
];

export function MiniGamesLeaderboardGrid() {
  const { settings } = useScoring();
  const { data: leaderboardPlayerCount = 3 } = useLeaderboardPlayerCount();
  const { data: dates = [], isLoading: isLoadingDates } = useAllLeaderboardDates();
  const [dateIdx, setDateIdx] = useState(0);

  const allDates = useMemo(() => {
    const today = todayDate();
    if (dates.length === 0) return [today];
    if (!dates.includes(today)) return [today, ...dates];
    return dates;
  }, [dates]);

  const selectedDate = allDates[dateIdx] ?? todayDate();
  const { data: gameData, isLoading } = usePlayersAllGames(selectedDate, settings);

  if (isLoading || isLoadingDates) return null;

  const games = gameData ? [...gameData.entries()].filter(([, players]) => players.length > 0) : [];
  if (games.length === 0) return null;

  const canGoPrev = dateIdx < allDates.length - 1;
  const canGoNext = dateIdx > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" />
          Game Leaderboards
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDateIdx(i => i + 1)} disabled={!canGoPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium text-muted-foreground min-w-[5rem] text-center">
            {selectedDate === todayDate() ? 'Today' : selectedDate}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDateIdx(i => i - 1)} disabled={!canGoNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2">
        {games.map(([gameId, players]) => {
          const label = GAME_LABELS[gameId] || { emoji: '🎮', name: gameId };
          return (
            <div
              key={gameId}
              className="rounded-xl border bg-secondary/20 p-3 sm:p-2.5 space-y-2 sm:space-y-1.5 min-w-0"
            >
              <p className="text-sm sm:text-xs font-semibold truncate">
                {label.emoji} {label.name}
              </p>
              {players.slice(0, leaderboardPlayerCount).map((p, i) => (
                <div key={p.player_name} className="flex items-center gap-2 sm:gap-1.5 min-w-0">
                  <div className="w-5 sm:w-4 shrink-0 flex justify-center">
                    {gameId === 'wordle' && 'solved' in p && !p.solved ? (
                      <span className="text-xs sm:text-[10px] text-muted-foreground">-</span>
                    ) : i === 0 ? (
                      <Trophy className={`h-4 w-4 sm:h-3.5 sm:w-3.5 ${RANK_COLORS[0]}`} />
                    ) : i <= 2 ? (
                      <Medal className={`h-4 w-4 sm:h-3.5 sm:w-3.5 ${RANK_COLORS[i]}`} />
                    ) : (
                      <span className="text-xs sm:text-[10px] text-muted-foreground">{i + 1}</span>
                    )}
                  </div>
                  <span className="text-base sm:text-sm shrink-0">{p.avatar}</span>
                  <span className="text-sm sm:text-xs truncate min-w-0">{p.player_name}</span>
                  <span className="ml-auto text-sm sm:text-xs font-mono text-accent font-semibold shrink-0">
                    {gameId === 'wordle' && 'solved' in p
                      ? (p.solved ? p.score : 'failed')
                      : p.score}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
