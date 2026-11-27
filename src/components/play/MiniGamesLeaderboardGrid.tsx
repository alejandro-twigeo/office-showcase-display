import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, ChevronLeft, ChevronRight, Swords, ArrowRight } from 'lucide-react';
import { dateFromIso, dedupeMinigameScores, todayDate, type MinigameScoreRow } from '@/hooks/useMinigameScore';
import { MINI_GAMES } from './miniGamesList';
import { calculateScore, calculateWordleScore, useScoring } from '@/hooks/useScoring';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLeaderboardPlayerCount } from '@/hooks/useGameIcons';
import { useRounds, type Round } from '@/hooks/useRounds';

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

/** A challenge sent that round: who, whom, which game, and how it went */
interface RoundChallenge {
  key: string;
  from: string;
  to: string;
  game: string;
  target: number;
  answer: number | null;
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

function usePlayersAllGames(selectedRound: Round | null, distanceSettings: ReturnType<typeof useScoring>['settings']) {
  return useQuery({
    queryKey: [
      'all-game-leaderboards',
      selectedRound?.id,
      distanceSettings.distance_parameter,
      JSON.stringify(distanceSettings.attempt_multipliers),
      JSON.stringify(distanceSettings.difficulty_weights),
    ],
    queryFn: async () => {
      if (!selectedRound?.id) return { byGame: new Map<string, TopPlayer[]>(), challenges: [] as RoundChallenge[], avatars: new Map<string, string>() };

      const { data: rawScores } = await supabase
        .from('minigame_scores')
        .select('id, game_id, date, player_name, device_id, score, meta, created_at, round_id')
        .eq('round_id', selectedRound.id)
        .order('score', { ascending: false });

      // Fetch avatars
      const { data: players } = await supabase.from('players').select('name, avatar');
      const avatarMap = new Map(players?.map(p => [p.name, p.avatar]) ?? []);

      // Group by game first, then dedupe within each game leaderboard.
      const byGame = new Map<string, TopPlayer[]>();
      const rawScoresByGame = new Map<string, MinigameScoreRow[]>();

      for (const score of ((rawScores ?? []) as MinigameScoreRow[])) {
        if (!rawScoresByGame.has(score.game_id)) rawScoresByGame.set(score.game_id, []);
        rawScoresByGame.get(score.game_id)!.push(score);
      }

      // Challenges are saved as rows too ("Ana>Ben>wordle"); they get their own card, not a leaderboard
      const challengeRows = rawScoresByGame.get('challenge') ?? [];
      rawScoresByGame.delete('challenge');

      for (const [gameId, gameScores] of rawScoresByGame.entries()) {
        byGame.set(gameId, dedupeMinigameScores(gameScores).map((score) => ({
          player_name: score.player_name,
          score: score.score,
          avatar: avatarMap.get(score.player_name) ?? '👤',
        })));
      }

      if (selectedRound.id) {
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

      // How each challenge went: the challenged player's score in that game this round
      const challenges: RoundChallenge[] = challengeRows
        .filter((r) => r.meta?.from && r.meta?.to && r.meta?.game)
        .map((r) => {
          const game = r.meta.game === 'geo' ? 'geoguessr' : r.meta.game;
          const theirs = byGame.get(game)?.find((p) => p.player_name === r.meta.to);
          return { key: r.player_name, from: r.meta.from, to: r.meta.to, game, target: Number(r.meta.target) || 0, answer: theirs ? theirs.score : null };
        })
        .sort((a, b) => b.key.localeCompare(a.key));

      return { byGame, challenges, avatars: avatarMap as Map<string, string> };
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
  const { rounds, isLoading: isLoadingRounds } = useRounds();
  const [roundIdx, setRoundIdx] = useState(0);

  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => {
      if (b.round_number !== a.round_number) return b.round_number - a.round_number;
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    }),
    [rounds]
  );

  const selectedRound = sortedRounds[roundIdx] ?? null;
  const { data: gameData, isLoading } = usePlayersAllGames(selectedRound, settings);
  const selectedRoundLabel = useMemo(() => {
    if (!selectedRound) return 'Today';
    const roundDate = dateFromIso(selectedRound.created_at);
    const today = todayDate();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const prefix = roundDate === today ? 'Today' : roundDate === yesterday ? 'Yesterday' : roundDate;
    return `${prefix} · Round ${selectedRound.round_number}`;
  }, [selectedRound]);

  if (isLoading || isLoadingRounds) return null;

  const games = gameData ? [...gameData.byGame.entries()].filter(([, players]) => players.length > 0) : [];
  const challenges = gameData?.challenges ?? [];
  if (games.length === 0 && challenges.length === 0) return null;

  const canGoPrev = roundIdx < sortedRounds.length - 1;
  const canGoNext = roundIdx > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" />
          Game Leaderboards
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRoundIdx(i => i + 1)} disabled={!canGoPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium text-muted-foreground min-w-[5rem] text-center">
            {selectedRoundLabel}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRoundIdx(i => i - 1)} disabled={!canGoNext}>
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
              className="glass-panel rounded-2xl p-3 sm:p-2.5 space-y-2 sm:space-y-1.5 min-w-0"
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
                  <PlayerAvatar avatar={p.avatar} name={p.player_name} size="1.7em" />
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

      {challenges.length > 0 && (
        <div className="glass-panel mt-2 space-y-1.5 rounded-2xl p-3 sm:p-2.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold sm:text-xs">
            <Swords className="h-3.5 w-3.5 text-primary" /> Challenges
          </p>
          {challenges.map((c) => {
            const status = c.answer === null ? 'open' : c.answer > c.target ? 'beaten' : 'held';
            return (
              <div key={c.key} className="flex min-w-0 items-center gap-1.5 text-sm sm:text-xs">
                <PlayerAvatar avatar={gameData?.avatars.get(c.from)} name={c.from} size="1.7em" />
                <span className="truncate font-medium">{c.from}</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <PlayerAvatar avatar={gameData?.avatars.get(c.to)} name={c.to} size="1.7em" />
                <span className="truncate font-medium">{c.to}</span>
                <span className="hidden truncate text-muted-foreground sm:inline">· {GAME_LABELS[c.game]?.name ?? c.game}</span>
                <span
                  className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold tabular-nums ${
                    status === 'beaten' ? 'bg-green-600/15 text-green-700' : status === 'held' ? 'bg-primary/15 text-primary' : 'bg-foreground/[0.06] text-muted-foreground'
                  }`}
                  title={`${GAME_LABELS[c.game]?.name ?? c.game}: beat ${c.target}`}
                >
                  {status === 'open' ? `Beat ${c.target}` : status === 'beaten' ? `${c.to.split(' ')[0]} won · ${c.answer}` : `${c.from.split(' ')[0]} held · ${c.target}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
