import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal } from 'lucide-react';
import { todayDate } from '@/hooks/useMinigameScore';
import { MINI_GAMES } from './miniGamesList';

interface TopPlayer {
  player_name: string;
  score: number;
  avatar: string;
}

const GAME_LABELS: Record<string, { emoji: string; name: string }> = {};
for (const g of MINI_GAMES) {
  GAME_LABELS[g.id] = { emoji: g.emoji, name: g.name };
}
// Add wordle/geoguessr which aren't in MINI_GAMES list but may have scores
GAME_LABELS['wordle'] = GAME_LABELS['wordle'] || { emoji: '🟩', name: 'Wordle' };
GAME_LABELS['geoguessr'] = { emoji: '📍', name: 'GeoGuessr' };

function useTop3AllGames() {
  const today = todayDate();
  return useQuery({
    queryKey: ['minigame_top3_all', today],
    queryFn: async () => {
      // Fetch today's scores for all games
      const { data: scores } = await supabase
        .from('minigame_scores')
        .select('game_id, player_name, score')
        .eq('date', today)
        .order('score', { ascending: false });

      // Fetch wordle scores for today
      const todayStart = today + 'T00:00:00.000Z';
      const todayEnd = today + 'T23:59:59.999Z';
      const { data: wordleScores } = await supabase
        .from('wordle_scores')
        .select('player_name, attempts, solved')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      // Fetch avatars
      const { data: players } = await supabase.from('players').select('name, avatar');
      const avatarMap = new Map(players?.map(p => [p.name, p.avatar]) ?? []);

      // Group by game, top 3
      const byGame = new Map<string, TopPlayer[]>();

      for (const s of (scores ?? [])) {
        if (!byGame.has(s.game_id)) byGame.set(s.game_id, []);
        const list = byGame.get(s.game_id)!;
        if (list.length < 3 && !list.some(p => p.player_name === s.player_name)) {
          list.push({
            player_name: s.player_name,
            score: s.score,
            avatar: avatarMap.get(s.player_name) ?? '👤',
          });
        }
      }

      // Add wordle (convert attempts to a simple score: solved in fewer = higher)
      if (wordleScores && wordleScores.length > 0) {
        const wordlePlayers = new Map<string, number>();
        for (const w of wordleScores) {
          if (!w.solved) continue;
          const score = Math.max(0, 100 - (w.attempts - 1) * 15);
          if (!wordlePlayers.has(w.player_name) || score > wordlePlayers.get(w.player_name)!) {
            wordlePlayers.set(w.player_name, score);
          }
        }
        const sorted = [...wordlePlayers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
        if (sorted.length > 0) {
          byGame.set('wordle', sorted.map(([name, score]) => ({
            player_name: name,
            score,
            avatar: avatarMap.get(name) ?? '👤',
          })));
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
  const { data: gameData, isLoading } = useTop3AllGames();

  if (isLoading) return null;

  const games = gameData ? [...gameData.entries()].filter(([, players]) => players.length > 0) : [];
  if (games.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
        <Trophy className="h-3.5 w-3.5" />
        Today's Leaderboards
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {games.map(([gameId, players]) => {
          const label = GAME_LABELS[gameId] || { emoji: '🎮', name: gameId };
          return (
            <div
              key={gameId}
              className="rounded-xl border bg-secondary/20 p-2.5 space-y-1.5"
            >
              <p className="text-xs font-semibold truncate">
                {label.emoji} {label.name}
              </p>
              {players.map((p, i) => (
                <div key={p.player_name} className="flex items-center gap-1.5">
                  <div className="w-4 shrink-0 flex justify-center">
                    {i === 0 ? (
                      <Trophy className={`h-3.5 w-3.5 ${RANK_COLORS[0]}`} />
                    ) : i <= 2 ? (
                      <Medal className={`h-3.5 w-3.5 ${RANK_COLORS[i]}`} />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                    )}
                  </div>
                  <span className="text-sm shrink-0">{p.avatar}</span>
                  <span className="text-xs truncate min-w-0">{p.player_name}</span>
                  <span className="ml-auto text-xs font-mono text-accent font-semibold">{p.score}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}