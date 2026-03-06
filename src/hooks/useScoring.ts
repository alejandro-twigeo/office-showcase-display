import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface DifficultyWeights {
  easy: number;
  hard: number;
}

export interface ScoringSettings {
  distance_parameter: number;
  attempt_multipliers: number[];
  difficulty_weights: DifficultyWeights;
  max_guesses_per_challenge: number | null;
  wordle_points: number;
  wordle_attempt_points: number[];
}

const DEFAULT_SETTINGS: ScoringSettings = {
  distance_parameter: 500,
  attempt_multipliers: [1.0, 0.9, 0.82, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45],
  difficulty_weights: { easy: 1.0, hard: 1.2 },
  max_guesses_per_challenge: null,
  wordle_points: 20,
  wordle_attempt_points: [20, 18, 15, 12, 10, 8],
};

export function useScoring() {
  const queryClient = useQueryClient();

  const { data: settings = DEFAULT_SETTINGS } = useQuery({
    queryKey: ['scoring_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_settings' as never)
        .select('distance_parameter, attempt_multipliers, difficulty_weights, max_guesses_per_challenge, wordle_points, wordle_attempt_points')
        .eq('id', 1)
        .single();
      if (error) return DEFAULT_SETTINGS;
      const raw = data as any;
      return {
        distance_parameter: Number(raw.distance_parameter),
        attempt_multipliers: (raw.attempt_multipliers as number[]),
        difficulty_weights: (raw.difficulty_weights as DifficultyWeights) ?? DEFAULT_SETTINGS.difficulty_weights,
        max_guesses_per_challenge: raw.max_guesses_per_challenge ?? null,
        wordle_points: raw.wordle_points ?? 20,
        wordle_attempt_points: (raw.wordle_attempt_points as number[]) ?? DEFAULT_SETTINGS.wordle_attempt_points,
      } as ScoringSettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (next: Partial<ScoringSettings>) => {
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (next.distance_parameter != null) updatePayload.distance_parameter = next.distance_parameter;
      if (next.attempt_multipliers) updatePayload.attempt_multipliers = next.attempt_multipliers;
      if (next.difficulty_weights) updatePayload.difficulty_weights = next.difficulty_weights;
      if (next.max_guesses_per_challenge !== undefined) updatePayload.max_guesses_per_challenge = next.max_guesses_per_challenge;
      if (next.wordle_points != null) updatePayload.wordle_points = next.wordle_points;
      if (next.wordle_attempt_points) updatePayload.wordle_attempt_points = next.wordle_attempt_points;

      const { error } = await supabase
        .from('scoring_settings' as never)
        .update(updatePayload as never)
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring_settings'] });
    },
  });

  // Real-time
  useEffect(() => {
    const channel = supabase
      .channel('scoring_settings_rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scoring_settings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['scoring_settings'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return { settings, updateSettings };
}

/** Calculate score for a guess */
export function calculateScore(
  distance_km: number,
  guessNumber: number,
  settings: ScoringSettings,
): number {
  const points = 100 / (1 + distance_km / settings.distance_parameter);
  const multiplierIndex = Math.min(guessNumber - 1, settings.attempt_multipliers.length - 1);
  const multiplier = settings.attempt_multipliers[multiplierIndex] ?? settings.attempt_multipliers[settings.attempt_multipliers.length - 1];
  return Math.round(points * multiplier);
}

/** Format "87 pts (42 km)" */
export function formatScoreDisplay(distance_km: number, score: number): string {
  const km = distance_km < 1
    ? `${Math.round(distance_km * 1000)} m`
    : `${Math.round(distance_km)} km`;
  return `${score} pts (${km})`;
}
