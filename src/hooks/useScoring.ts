import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface ScoringSettings {
  distance_parameter: number;
  attempt_multipliers: number[];
}

const DEFAULT_SETTINGS: ScoringSettings = {
  distance_parameter: 500,
  attempt_multipliers: [1.0, 0.9, 0.82, 0.75, 0.7],
};

export function useScoring() {
  const queryClient = useQueryClient();

  const { data: settings = DEFAULT_SETTINGS } = useQuery({
    queryKey: ['scoring_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scoring_settings' as never)
        .select('distance_parameter, attempt_multipliers')
        .eq('id', 1)
        .single();
      if (error) return DEFAULT_SETTINGS;
      const raw = data as { distance_parameter: number; attempt_multipliers: unknown };
      return {
        distance_parameter: Number(raw.distance_parameter),
        attempt_multipliers: (raw.attempt_multipliers as number[]),
      } as ScoringSettings;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (next: ScoringSettings) => {
      const { error } = await supabase
        .from('scoring_settings' as never)
        .update({
          distance_parameter: next.distance_parameter,
          attempt_multipliers: next.attempt_multipliers,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring_settings'] });
    },
  });

  // Real-time: refresh when settings change in DB
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
