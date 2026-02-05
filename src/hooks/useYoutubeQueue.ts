import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  queued_by: string;
  is_playing: boolean;
  played_at: string | null;
  created_at: string | null;
}

export function useYoutubeQueue() {
  const queryClient = useQueryClient();

  const { data: currentVideo, isLoading: loadingCurrent } = useQuery({
    queryKey: ['current-video'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_queue')
        .select('*')
        .eq('is_playing', true)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as YouTubeVideo | null;
    },
  });

  const { data: recentVideos = [], isLoading: loadingRecent } = useQuery({
    queryKey: ['recent-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('youtube_queue')
        .select('*')
        .not('played_at', 'is', null)
        .order('played_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as YouTubeVideo[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('youtube-queue-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'youtube_queue' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['current-video'] });
          queryClient.invalidateQueries({ queryKey: ['recent-videos'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const playVideo = useMutation({
    mutationFn: async (data: { video_id: string; title: string; queued_by: string }) => {
      // Stop current video
      await supabase
        .from('youtube_queue')
        .update({ is_playing: false, played_at: new Date().toISOString() })
        .eq('is_playing', true);

      // Start new video
      const { error } = await supabase.from('youtube_queue').insert({
        video_id: data.video_id,
        title: data.title,
        queued_by: data.queued_by,
        is_playing: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-video'] });
      queryClient.invalidateQueries({ queryKey: ['recent-videos'] });
    },
  });

  return {
    currentVideo,
    recentVideos,
    isLoading: loadingCurrent || loadingRecent,
    playVideo,
  };
}
