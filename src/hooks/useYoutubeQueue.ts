import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string | null;
  thumbnail_url: string | null;
  queued_by: string;
  is_playing: boolean;
  is_favorite: boolean | null;
  played_at: string | null;
  created_at: string | null;
}

async function fetchYouTubeMeta(
  videoId: string
): Promise<{ title: string; thumbnail_url: string }> {
  const fallback = {
    title: `Video ${videoId}`,
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };

  try {
    console.log("Fetching YouTube meta for:", videoId);

    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;

    const res = await fetch(url);

    console.log("oEmbed status:", res.status);

    if (!res.ok) {
      console.warn("oEmbed response not OK, using fallback");
      return fallback;
    }

    const json = await res.json();
    console.log("oEmbed JSON:", json);

    return {
      title: json?.title ?? fallback.title,
      thumbnail_url: json?.thumbnail_url ?? fallback.thumbnail_url,
    };
  } catch (error) {
    console.error("YouTube meta fetch failed:", error);
    return fallback;
  }
}

//async function fetchYouTubeMeta(videoId: string): Promise<{ title: string; thumbnail_url: string }> {
  // No API key required
//  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
//    `https://www.youtube.com/watch?v=${videoId}`
//  )}&format=json`;

//  const res = await fetch(url);
//  if (!res.ok) {
//    // fallback (still gives you a thumbnail)
//    return {
//      title: `Video ${videoId}`,
 //     thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
   // };
  //}

  const json = (await res.json()) as { title?: string; thumbnail_url?: string };
  return {
    title: json.title ?? `Video ${videoId}`,
    thumbnail_url: json.thumbnail_url ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
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
      // stop current
      await supabase
        .from("youtube_queue")
        .update({ is_playing: false, played_at: new Date().toISOString() })
        .eq("is_playing", true);

      const meta = await fetchYouTubeMeta(data.video_id);

      const { error } = await supabase.from("youtube_queue").insert({
        video_id: data.video_id,
        title: meta.title,
        thumbnail_url: meta.thumbnail_url,
        queued_by: data.queued_by,
        is_playing: true,
        is_favorite: false,
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
        .update({ video_id: data.video_id, title: meta.title, thumbnail_url: meta.thumbnail_url })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-video"] });
      queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
    },
  });

  const deleteVideo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("youtube_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-video"] });
      queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async (data: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase
        .from("youtube_queue")
        .update({ is_favorite: data.is_favorite })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-videos"] });
    },
  });

  return {
    currentVideo,
    recentVideos,
    isLoading: loadingCurrent || loadingRecent,
    playVideo,
    updateVideo,
    deleteVideo,
    toggleFavorite,
  };
}
