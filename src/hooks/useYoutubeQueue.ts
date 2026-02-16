import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  queued_by: string;
  is_playing: boolean;
  is_favorite: boolean;
  played_at: string | null;
  created_at: string | null;

  // optional if you add it
  is_deleted?: boolean;
}

// Accepts full URL or plain id and returns the id
function extractVideoId(input: string): string {
  const trimmed = input.trim();

  // Already looks like an id
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    // youtu.be/<id>
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '');
      return id;
    }
    // youtube.com/watch?v=<id>
    const v = url.searchParams.get('v');
    if (v) return v;

    // youtube.com/shorts/<id>
    const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch?.[1]) return shortsMatch[1];
  } catch {
    // Not a URL, fall through
  }

  // Last resort: return as-is
  return trimmed;
}

// No API key: YouTube oEmbed gives title + thumbnail
async function fetchYouTubeMeta(videoId: string): Promise<{ title: string; thumbnail_url: string }> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;

  const res = await fetch(oembedUrl);
  if (!res.ok) {
    // Fallback thumbnail even if oEmbed fails
    return {
      title: videoId,
      thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
  const json = await res.json();
  return {
    title: json?.title ?? videoId,
    thumbnail_url: json?.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
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
      let q = supabase
        .from('youtube_queue')
        .select('*')
        .not('played_at', 'is', null)
        .order('played_at', { ascending: false })
        .limit(20);

      // If you added is_deleted:
      // q = q.eq('is_deleted', false);

      const { data, error } = await q;
      if (error) throw error;
      return data as YouTubeVideo[];
    },
  });

  // Favorites should "always show there"
  const { data: favoriteVideos = [], isLoading: loadingFavs } = useQuery({
    queryKey: ['favorite-videos'],
    queryFn: async () => {
      let q = supabase
        .from('youtube_queue')
        .select('*')
        .eq('is_favorite', true)
        .order('created_at', { ascending: false })
        .limit(50);

      // If you added is_deleted:
      // q = q.eq('is_deleted', false);

      const { data, error } = await q;
      if (error) throw error;
      return data as YouTubeVideo[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('youtube-queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_queue' }, () => {
        queryClient.invalidateQueries({ queryKey: ['current-video'] });
        queryClient.invalidateQueries({ queryKey: ['recent-videos'] });
        queryClient.invalidateQueries({ queryKey: ['favorite-videos'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const playVideo = useMutation({
    mutationFn: async (data: { video_input: string; queued_by: string }) => {
      const videoId = extractVideoId(data.video_input);
      const meta = await fetchYouTubeMeta(videoId);

      // Stop current video
      await supabase
        .from('youtube_queue')
        .update({ is_playing: false, played_at: new Date().toISOString() })
        .eq('is_playing', true);

      // Start new video
      const { error } = await supabase.from('youtube_queue').insert({
        video_id: videoId,
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
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

  const updateVideo = useMutation({
    mutationFn: async (data: { id: string; video_input: string }) => {
      const videoId = extractVideoId(data.video_input);
      const meta = await fetchYouTubeMeta(videoId);

      const { error } = await supabase
        .from('youtube_queue')
        .update({ video_id: videoId, title: meta.title, thumbnail_url: meta.thumbnail_url })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-video'] });
      queryClient.invalidateQueries({ queryKey: ['recent-videos'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-videos'] });
    },
  });

  // Remove a single previously viewed video
  const removeHistoryItem = useMutation({
    mutationFn: async (id: string) => {
      // Option A: hard delete
      const { error } = await supabase.from('youtube_queue').delete().eq('id', id);

      // Option B: soft delete (if you added is_deleted)
      // const { error } = await supabase.from('youtube_queue').update({ is_deleted: true }).eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-videos'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-videos'] });
    },
  });

  // Remove all previously viewed videos
  const clearHistory = useMutation({
    mutationFn: async () => {
      // Only delete "previously viewed"
      let q = supabase.from('youtube_queue').delete().not('played_at', 'is', null);

      // If you want to keep favorites even when clearing history:
      // q = q.eq('is_favorite', false);

      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-videos'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-videos'] });
    },
  });

  // Toggle favorite so it always shows
  const toggleFavorite = useMutation({
    mutationFn: async (data: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase
        .from('youtube_queue')
        .update({ is_favorite: data.is_favorite })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-videos'] });
      queryClient.invalidateQueries({ queryKey: ['favorite-videos'] });
    },
  });

  return {
    currentVideo,
    recentVideos,
    favoriteVideos,
    isLoading: loadingCurrent || loadingRecent || loadingFavs,

    playVideo,
    updateVideo,

    removeHistoryItem,
    clearHistory,
    toggleFavorite,
  };
}
