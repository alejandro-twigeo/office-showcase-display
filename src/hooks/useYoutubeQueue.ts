import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export type VideoStatus = "queued" | "playing" | "played";

export interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  queued_by: string;
  is_playing: boolean | null;
  is_favorite: boolean;
  is_deleted: boolean;
  played_at: string | null;
  created_at: string | null;
  queued_at: string | null;
  status: VideoStatus;
  channel_title: string | null;
}

// Typed Supabase table accessor that avoids deep type instantiation
// since `status` and `queued_at` are new columns not yet reflected in generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ytQueue = () => (supabase as any).from("youtube_queue");

async function fetchYouTubeMeta(
  videoId: string
): Promise<{ title: string; thumbnail_url: string }> {
  const fallback = {
    title: `Video ${videoId}`,
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return fallback;
    const json = await res.json();
    return {
      title: json?.title ?? fallback.title,
      thumbnail_url: json?.thumbnail_url ?? fallback.thumbnail_url,
    };
  } catch {
    return fallback;
  }
}

export function useYoutubeQueue() {
  const queryClient = useQueryClient();

  // Current playing video
  const { data: currentVideo, isLoading: loadingCurrent } = useQuery<YouTubeVideo | null>({
    queryKey: ["current-video"],
    queryFn: async (): Promise<YouTubeVideo | null> => {
      const { data, error } = await ytQueue()
        .select("*")
        .eq("status", "playing")
        .eq("is_deleted", false)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as YouTubeVideo | null;
    },
  });

  // Queued videos ordered by queued_at
  const { data: queue = [], isLoading: loadingQueue } = useQuery<YouTubeVideo[]>({
    queryKey: ["video-queue"],
    queryFn: async (): Promise<YouTubeVideo[]> => {
      const { data, error } = await ytQueue()
        .select("*")
        .eq("status", "queued")
        .eq("is_deleted", false)
        .order("queued_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as YouTubeVideo[];
    },
  });

  // All played videos (paginated in UI)
  const { data: recentVideos = [], isLoading: loadingRecent } = useQuery<YouTubeVideo[]>({
    queryKey: ["recent-videos"],
    queryFn: async (): Promise<YouTubeVideo[]> => {
      const { data, error } = await ytQueue()
        .select("*")
        .eq("status", "played")
        .eq("is_deleted", false)
        .order("played_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as YouTubeVideo[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("youtube-queue-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "youtube_queue" }, () => {
        queryClient.invalidateQueries({ queryKey: ["current-video"] });
        queryClient.invalidateQueries({ queryKey: ["video-queue"] });
        queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Play Now: stop everything, insert new video as 'playing'
  const playNow = useMutation({
    mutationFn: async (data: { video_id: string; queued_by: string }) => {
      // Mark all playing/queued as played
      await ytQueue()
        .update({ status: "played", is_playing: false, played_at: new Date().toISOString() })
        .in("status", ["playing", "queued"]);

      const meta = await fetchYouTubeMeta(data.video_id);

      const { error } = await ytQueue().insert({
        video_id: data.video_id,
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
        queued_by: data.queued_by,
        is_playing: true,
        is_favorite: false,
        is_deleted: false,
        status: "playing",
        queued_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-video"] });
      queryClient.invalidateQueries({ queryKey: ["video-queue"] });
      queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
    },
  });

  // Add to Queue: insert with status 'queued'
  const addToQueue = useMutation({
    mutationFn: async (data: { video_id: string; queued_by: string }) => {
      const meta = await fetchYouTubeMeta(data.video_id);
      const { error } = await ytQueue().insert({
        video_id: data.video_id,
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
        queued_by: data.queued_by,
        is_playing: false,
        is_favorite: false,
        is_deleted: false,
        status: "queued",
        queued_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-queue"] });
    },
  });

  // Advance to next in queue (called when video ends)
  const advanceQueue = useMutation({
    mutationFn: async (currentId?: string) => {
      // Mark current as played
      if (currentId) {
        await ytQueue()
          .update({ status: "played", is_playing: false, played_at: new Date().toISOString() })
          .eq("id", currentId);
      } else {
        await ytQueue()
          .update({ status: "played", is_playing: false, played_at: new Date().toISOString() })
          .eq("status", "playing");
      }

      // Find next queued video
      const { data: next } = await ytQueue()
        .select("*")
        .eq("status", "queued")
        .eq("is_deleted", false)
        .order("queued_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (next) {
        await ytQueue()
          .update({ status: "playing", is_playing: true })
          .eq("id", next.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-video"] });
      queryClient.invalidateQueries({ queryKey: ["video-queue"] });
      queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
    },
  });

  // Reorder queue by updating queued_at timestamps
  const reorderQueue = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Assign evenly spaced timestamps to preserve order
      const base = Date.now();
      await Promise.all(
        orderedIds.map((id, idx) =>
          ytQueue()
            .update({ queued_at: new Date(base + idx * 1000).toISOString() })
            .eq("id", id)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-queue"] });
    },
  });

  // Remove from queue (soft delete)
  const removeFromQueue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await ytQueue().update({ is_deleted: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-queue"] });
      queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
    },
  });

  // Toggle favorite
  const toggleFavorite = useMutation({
    mutationFn: async (data: { id: string; is_favorite: boolean }) => {
      const { error } = await ytQueue()
        .update({ is_favorite: data.is_favorite })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
      queryClient.invalidateQueries({ queryKey: ["video-queue"] });
      queryClient.invalidateQueries({ queryKey: ["current-video"] });
    },
  });

  return {
    currentVideo,
    queue,
    recentVideos,
    isLoading: loadingCurrent || loadingQueue || loadingRecent,
    playNow,
    addToQueue,
    advanceQueue,
    removeFromQueue,
    reorderQueue,
    toggleFavorite,
  };
}
