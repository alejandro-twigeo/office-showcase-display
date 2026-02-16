import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  queued_by: string;
  is_playing: boolean;
  played_at: string | null;
  created_at: string | null;

  thumbnail_url?: string | null;
  channel_title?: string | null;
  is_favorite?: boolean | null;
}

async function fetchYouTubeMeta(videoId: string): Promise<{
  title: string;
  thumbnail_url: string;
  channel_title: string;
}> {
  // Fallback thumbnail always exists even if oEmbed fails
  const fallbackThumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;

    const res = await fetch(url);
    if (!res.ok) {
      return { title: `Video ${videoId}`, thumbnail_url: fallbackThumb, channel_title: "YouTube" };
    }

    const json = (await res.json()) as { title?: string; thumbnail_url?: string; author_name?: string };
    return {
      title: json.title ?? `Video ${videoId}`,
      thumbnail_url: json.thumbnail_url ?? fallbackThumb,
      channel_title: json.author_name ?? "YouTube",
    };
  } catch {
    return { title: `Video ${videoId}`, thumbnail_url: fallbackThumb, channel_title: "YouTube" };
  }
}

export function useYoutubeQueue() {
  const queryClient = useQueryClient();

  const { data: currentVideo, isLoading: loadingCurrent } = useQuery({
    queryKey: ["current-video"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_queue")
        .select("*")
        .eq("is_playing", true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as YouTubeVideo | null;
    },
  });

  const { data: recentVideos = [], isLoading: loadingRecent } = useQuery({
    queryKey: ["recent-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youtube_queue")
        .select("*")
        .not("played_at", "is", null)
        .order("played_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as YouTubeVideo[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("youtube-queue-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "youtube_queue" }, () => {
        queryClient.invalidateQueries({ queryKey: ["current-video"] });
        queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const playVideo = useMutation({
    mutationFn: async (data: { video_id: string; queued_by: string }) => {
      // Stop current
      await supabase
        .from("youtube_queue")
        .update({ is_playing: false, played_at: new Date().toISOString() })
        .eq("is_playing", true);

      // Fetch meta then insert
      const meta = await fetchYouTubeMeta(data.video_id);

      const { error } = await supabase.from("youtube_queue").insert({
        video_id: data.video_id,
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
        channel_title: meta.channel_title,
        queued_by: data.queued_by,
        is_playing: true,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-video"] });
      queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
    },
  });

  const updateVideo = useMutation({
    mutationFn: async (data: { id: string; video_id: string }) => {
      const meta = await fetchYouTubeMeta(data.video_id);

      const { error } = await supabase
        .from("youtube_queue")
        .update({
          video_id: data.video_id,
          title: meta.title,
          thumbnail_url: meta.thumbnail_url,
          channel_title: meta.channel_title,
        })
        .eq("id", data.id);

      if (error) thr
