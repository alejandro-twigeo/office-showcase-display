import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface RoundSchedule {
  enabled: boolean;
  reset_hour: number;
  last_auto_reset_at: string | null;
}

export function useRoundSchedule() {
  const queryClient = useQueryClient();

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['round_schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('round_schedule' as any)
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw error;
      const d = data as any;
      return {
        enabled: d.enabled as boolean,
        reset_hour: d.reset_hour as number,
        last_auto_reset_at: d.last_auto_reset_at as string | null,
      } as RoundSchedule;
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async (updates: Partial<Pick<RoundSchedule, 'enabled' | 'reset_hour'>>) => {
      const { error } = await supabase
        .from('round_schedule' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['round_schedule'] });
    },
  });

  // Real-time
  useEffect(() => {
    const channel = supabase
      .channel('round-schedule-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_schedule' }, () => {
        queryClient.invalidateQueries({ queryKey: ['round_schedule'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return { schedule: schedule ?? null, isLoading, updateSchedule };
}
