import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface Round {
  id: string;
  round_number: number;
  is_active: boolean;
  created_at: string;
}

export function useRounds() {
  const queryClient = useQueryClient();

  const { data: rounds = [], isLoading } = useQuery({
    queryKey: ['rounds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rounds' as any)
        .select('*')
        .order('round_number', { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r: any) => ({
        id: r.id,
        round_number: r.round_number,
        is_active: r.is_active,
        created_at: r.created_at,
      })) as Round[];
    },
  });

  const activeRound = rounds.find(r => r.is_active) ?? null;

  // Real-time
  useEffect(() => {
    const channel = supabase
      .channel(`rounds-rt-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, () => {
        queryClient.invalidateQueries({ queryKey: ['rounds'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return { rounds, activeRound, isLoading };
}
