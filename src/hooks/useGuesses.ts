import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface Guess {
  id: string;
  location_id: string;
  device_id: string;
  player_name: string;
  lat: number;
  lng: number;
  distance_km: number;
  guess_number: number;
  created_at: string | null;
}

export function useGuesses(locationId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: guesses = [], isLoading } = useQuery({
    queryKey: ['guesses', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      
      const { data, error } = await supabase
        .from('guesses')
        .select('*')
        .eq('location_id', locationId)
        .order('distance_km', { ascending: true });
      
      if (error) throw error;
      return data as Guess[];
    },
    enabled: !!locationId,
  });

  // Real-time subscription
  useEffect(() => {
    if (!locationId) return;

    const channel = supabase
      .channel(`guesses-${locationId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'guesses',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['guesses', locationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, queryClient]);

  return { guesses, isLoading };
}

export function useUserGuesses(locationId: string | undefined, deviceId: string, maxGuesses?: number) {
  const queryClient = useQueryClient();

  const { data: userGuesses = [], isLoading } = useQuery({
    queryKey: ['user-guesses', locationId, deviceId],
    queryFn: async () => {
      if (!locationId || !deviceId) return [];
      
      const { data, error } = await supabase
        .from('guesses')
        .select('*')
        .eq('location_id', locationId)
        .eq('device_id', deviceId)
        .order('guess_number', { ascending: true });
      
      if (error) throw error;
      return data as Guess[];
    },
    enabled: !!locationId && !!deviceId,
  });

  const submitGuess = useMutation({
    mutationFn: async (data: {
      location_id: string;
      device_id: string;
      player_name: string;
      lat: number;
      lng: number;
      distance_km: number;
      guess_number: number;
    }) => {
      const { error } = await supabase.from('guesses').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-guesses', locationId, deviceId] });
      queryClient.invalidateQueries({ queryKey: ['guesses', locationId] });
    },
  });

  const limit = maxGuesses ?? 3;
  const remainingGuesses = Math.max(0, limit - userGuesses.length);

  return { userGuesses, isLoading, submitGuess, remainingGuesses };
}
