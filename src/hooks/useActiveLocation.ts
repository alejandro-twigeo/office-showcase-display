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
}

export function useActiveLocation() {
  const queryClient = useQueryClient();

  const { data: activeLocation, isLoading, error } = useQuery({
    queryKey: ['active-location'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as Location | null;
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('locations-changes')
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
  }, [queryClient]);

  const createNewLocation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number; pano_id?: string }) => {
      // Deactivate current location
      await supabase
        .from('locations')
        .update({ is_active: false })
        .eq('is_active', true);

      // Create new active location
      const { data, error } = await supabase
        .from('locations')
        .insert({
          lat: coords.lat,
          lng: coords.lng,
          pano_id: coords.pano_id || null,
          is_active: true,
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
