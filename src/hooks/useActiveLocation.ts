import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface Location {
  id: string;
  lat: number;
  lng: number;
  pano_id: string | null;
  is_active: boolean;
  created_at: string | null;
  difficulty: number;
}

/**
 * Fetch the active location for a given difficulty (1=Easy, 3=Hard).
 * Multiple locations can be active simultaneously (one per difficulty).
 */
export function useActiveLocation(difficulty?: number) {
  const queryClient = useQueryClient();

  const { data: activeLocation, isLoading, error } = useQuery({
    queryKey: ['active-location', difficulty],
    queryFn: async () => {
      let query = supabase
        .from('locations')
        .select('*')
        .eq('is_active', true);
      
      if (difficulty != null) {
        query = query.eq('difficulty', difficulty);
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data as Location | null;
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`locations-changes-${difficulty ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['active-location'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, difficulty]);

  const createNewLocation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number; pano_id?: string; difficulty?: number }) => {
      const diff = coords.difficulty ?? 1;

      // Deactivate current location for THIS difficulty only
      await supabase
        .from('locations')
        .update({ is_active: false })
        .eq('is_active', true)
        .eq('difficulty', diff);

      // Create new active location
      const { data, error } = await supabase
        .from('locations')
        .insert({
          lat: coords.lat,
          lng: coords.lng,
          pano_id: coords.pano_id || null,
          is_active: true,
          difficulty: diff,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-location'] });
      queryClient.invalidateQueries({ queryKey: ['guesses'] });
    },
  });

  return {
    activeLocation,
    isLoading,
    error,
    createNewLocation,
  };
}
