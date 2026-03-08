import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface MinigameScoreRow {
  id: string;
  game_id: string;
  date: string;
  player_name: string;
  device_id: string;
  score: number;
  meta: Record<string, any>;
  created_at: string;
}

/** Get today's date string in YYYY-MM-DD */
export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Deterministic daily seed from date string */
export function dateSeed(dateStr: string): number {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Seeded PRNG (simple mulberry32) */
export function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shuffle array with seeded PRNG */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  const rng = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Hook: fetch all dates that have scores for a game */
export function useMinigameDates(gameId: string) {
  return useQuery({
    queryKey: ['minigame_dates', gameId],
    queryFn: async () => {
      const { data } = await supabase
        .from('minigame_scores' as any)
        .select('date')
        .eq('game_id', gameId)
        .order('date', { ascending: false });
      const dates = [...new Set((data ?? []).map((d: any) => d.date))];
      return dates as string[];
    },
  });
}

/** Hook: fetch scores for a game on a specific date */
export function useMinigameLeaderboard(gameId: string, date: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['minigame_leaderboard', gameId, date],
    queryFn: async () => {
      const { data } = await supabase
        .from('minigame_scores' as any)
        .select('*')
        .eq('game_id', gameId)
        .eq('date', date)
        .order('score', { ascending: false });
      return (data ?? []) as unknown as MinigameScoreRow[];
    },
    enabled: !!date,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`minigame_scores_${gameId}_${date}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'minigame_scores',
        filter: `game_id=eq.${gameId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['minigame_leaderboard', gameId, date] });
        queryClient.invalidateQueries({ queryKey: ['minigame_dates', gameId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId, date, queryClient]);

  return query;
}

/** Hook: check if player already played today */
export function useMinigameTodayScore(gameId: string, playerName: string) {
  return useQuery({
    queryKey: ['minigame_today', gameId, playerName],
    queryFn: async () => {
      const { data } = await supabase
        .from('minigame_scores' as any)
        .select('*')
        .eq('game_id', gameId)
        .eq('date', todayDate())
        .eq('player_name', playerName)
        .maybeSingle();
      return data as unknown as MinigameScoreRow | null;
    },
    enabled: !!playerName,
  });
}

/** Hook: submit a score */
export function useSubmitMinigameScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      game_id: string;
      player_name: string;
      device_id: string;
      score: number;
      meta?: Record<string, any>;
      date?: string;
    }) => {
      const { error } = await supabase
        .from('minigame_scores' as any)
        .upsert({
          game_id: params.game_id,
          date: params.date ?? todayDate(),
          player_name: params.player_name,
          device_id: params.device_id,
          score: params.score,
          meta: params.meta ?? {},
        } as any, { onConflict: 'game_id,date,player_name' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['minigame_leaderboard', vars.game_id] });
      queryClient.invalidateQueries({ queryKey: ['minigame_today', vars.game_id, vars.player_name] });
      queryClient.invalidateQueries({ queryKey: ['minigame_dates', vars.game_id] });
    },
  });
}
