import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface Playlist {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  channel_title: string | null;
  added_by: string;
  position: number;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plists = () => (supabase as any).from("playlists");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pitems = () => (supabase as any).from("playlist_items");

export function usePlaylists() {
  const queryClient = useQueryClient();

  // All playlists
  const { data: playlists = [], isLoading } = useQuery<Playlist[]>({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await plists()
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Playlist[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("playlists-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "playlists" }, () => {
        queryClient.invalidateQueries({ queryKey: ["playlists"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "playlist_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["playlist-items"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Create playlist
  const createPlaylist = useMutation({
    mutationFn: async (data: { name: string; created_by: string }) => {
      const { data: row, error } = await plists()
        .insert({ name: data.name, created_by: data.created_by })
        .select()
        .single();
      if (error) throw error;
      return row as Playlist;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });

  // Delete playlist
  const deletePlaylist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await plists().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-items"] });
    },
  });

  // Rename playlist
  const renamePlaylist = useMutation({
    mutationFn: async (data: { id: string; name: string }) => {
      const { error } = await plists().update({ name: data.name }).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });

  return { playlists, isLoading, createPlaylist, deletePlaylist, renamePlaylist };
}

export function usePlaylistItems(playlistId: string | null) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery<PlaylistItem[]>({
    queryKey: ["playlist-items", playlistId],
    enabled: !!playlistId,
    queryFn: async () => {
      const { data, error } = await pitems()
        .select("*")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlaylistItem[];
    },
  });

  // Add item to playlist
  const addItem = useMutation({
    mutationFn: async (data: {
      playlist_id: string;
      video_id: string;
      title: string;
      thumbnail_url?: string | null;
      channel_title?: string | null;
      added_by: string;
      position?: number;
    }) => {
      // Get current max position
      const { data: existing } = await pitems()
        .select("position")
        .eq("playlist_id", data.playlist_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      const position = (existing?.position ?? -1) + 1;

      // Avoid exact duplicate video_id in same playlist
      const { data: dup } = await pitems()
        .select("id")
        .eq("playlist_id", data.playlist_id)
        .eq("video_id", data.video_id)
        .limit(1)
        .maybeSingle();

      if (dup) return; // already in list

      const { error } = await pitems().insert({
        playlist_id: data.playlist_id,
        video_id: data.video_id,
        title: data.title,
        thumbnail_url: data.thumbnail_url ?? null,
        channel_title: data.channel_title ?? null,
        added_by: data.added_by,
        position,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlist-items"] }),
  });

  // Remove item from playlist
  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await pitems().delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlist-items", playlistId] }),
  });

  return { items, isLoading, addItem, removeItem };
}
