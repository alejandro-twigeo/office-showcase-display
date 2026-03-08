import { useScoring } from './useScoring';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MinigameSettings {
  city_guess_distance_param: number;
  city_guess_max_attempts: number;
  city_guess_attempt_multipliers: number[];
  thisorthat_points_per_q: number;
  thisorthat_streak_bonus: number;
  sudoku_max_points: number;
  sudoku_time_param: number;
  pairs_max_points: number;
  pairs_time_param: number;
  pairs_move_penalty: number;
  labyrinth_max_points: number;
  labyrinth_time_param: number;
  labyrinth_reset_penalty: number;
}

const DEFAULTS: MinigameSettings = {
  city_guess_distance_param: 200,
  city_guess_max_attempts: 3,
  city_guess_attempt_multipliers: [1.0, 0.75, 0.5],
  thisorthat_points_per_q: 5,
  thisorthat_streak_bonus: 0.2,
  sudoku_max_points: 100,
  sudoku_time_param: 300,
  pairs_max_points: 100,
  pairs_time_param: 120,
  pairs_move_penalty: 2,
  labyrinth_max_points: 100,
  labyrinth_time_param: 60,
  labyrinth_reset_penalty: 5,
};

export function useMinigameSettings(): MinigameSettings {
  const { data } = useQuery({
    queryKey: ['minigame_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_settings' as never)
        .select('city_guess_distance_param, city_guess_max_attempts, city_guess_attempt_multipliers, thisorthat_points_per_q, thisorthat_streak_bonus, sudoku_max_points, sudoku_time_param, pairs_max_points, pairs_time_param, pairs_move_penalty, labyrinth_max_points, labyrinth_time_param, labyrinth_reset_penalty')
        .eq('id', 1)
        .single();
      if (error) return DEFAULTS;
      const r = data as any;
      return {
        city_guess_distance_param: Number(r.city_guess_distance_param ?? DEFAULTS.city_guess_distance_param),
        city_guess_max_attempts: Number(r.city_guess_max_attempts ?? DEFAULTS.city_guess_max_attempts),
        city_guess_attempt_multipliers: (r.city_guess_attempt_multipliers as number[]) ?? DEFAULTS.city_guess_attempt_multipliers,
        thisorthat_points_per_q: Number(r.thisorthat_points_per_q ?? DEFAULTS.thisorthat_points_per_q),
        thisorthat_streak_bonus: Number(r.thisorthat_streak_bonus ?? DEFAULTS.thisorthat_streak_bonus),
        sudoku_max_points: Number(r.sudoku_max_points ?? DEFAULTS.sudoku_max_points),
        sudoku_time_param: Number(r.sudoku_time_param ?? DEFAULTS.sudoku_time_param),
        pairs_max_points: Number(r.pairs_max_points ?? DEFAULTS.pairs_max_points),
        pairs_time_param: Number(r.pairs_time_param ?? DEFAULTS.pairs_time_param),
        pairs_move_penalty: Number(r.pairs_move_penalty ?? DEFAULTS.pairs_move_penalty),
        labyrinth_max_points: Number(r.labyrinth_max_points ?? DEFAULTS.labyrinth_max_points),
        labyrinth_time_param: Number(r.labyrinth_time_param ?? DEFAULTS.labyrinth_time_param),
        labyrinth_reset_penalty: Number(r.labyrinth_reset_penalty ?? DEFAULTS.labyrinth_reset_penalty),
      } as MinigameSettings;
    },
  });
  return data ?? DEFAULTS;
}
