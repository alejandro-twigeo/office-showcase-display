import { useState, useCallback, useEffect } from "react";
import { fetchYouTubeMeta, type YouTubeVideo, type VideoStatus } from "./useYoutubeQueue";
import { v4 as uuid } from "uuid";

const STORAGE_KEY = "private-music-queue";

interface PrivateState {
  currentVideo: YouTubeVideo | null;
  queue: YouTubeVideo[];
  history: YouTubeVideo[];
}

function loadState(): PrivateState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { currentVideo: null, queue: [], history: [] };
}

function saveState(state: PrivateState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeVideo(
  videoId: string,
  title: string,
  thumbnail_url: string,
  queued_by: string,
  status: VideoStatus,
): YouTubeVideo {
  return {
    id: uuid(),
    video_id: videoId,
    title,
    thumbnail_url,
    queued_by,
    is_playing: status === "playing",
    is_favorite: false,
    is_deleted: false,
    played_at: status === "played" ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
    queued_at: new Date().toISOString(),
    status,
    channel_title: null,
  };
}

export function usePrivateQueue() {
  const [state, setState] = useState<PrivateState>(loadState);

  useEffect(() => { saveState(state); }, [state]);

  const { currentVideo, queue, history } = state;

  // Deduplicated recent videos (history + current + queue merged)
  const recentVideos = (() => {
    const all = [...history, ...(currentVideo ? [currentVideo] : []), ...queue];
    const seen = new Set<string>();
    return all.filter((v) => {
      if (seen.has(v.video_id)) return false;
      seen.add(v.video_id);
      return true;
    });
  })();

  const playNow = {
    isPending: false,
    mutate: async (data: { video_id: string; queued_by: string }, opts?: { onSuccess?: () => void }) => {
      const meta = await fetchYouTubeMeta(data.video_id);
      const video = makeVideo(data.video_id, meta.title, meta.thumbnail_url, data.queued_by, "playing");
      setState((prev) => {
        const newHistory = prev.currentVideo
          ? [{ ...prev.currentVideo, status: "played" as VideoStatus, is_playing: false, played_at: new Date().toISOString() }, ...prev.history]
          : prev.history;
        return { currentVideo: video, queue: prev.queue, history: newHistory.slice(0, 100) };
      });
      opts?.onSuccess?.();
    },
  };

  const addToQueue = {
    isPending: false,
    mutate: async (data: { video_id: string; queued_by: string }, opts?: { onSuccess?: () => void }) => {
      const meta = await fetchYouTubeMeta(data.video_id);
      const video = makeVideo(data.video_id, meta.title, meta.thumbnail_url, data.queued_by, "queued");
      setState((prev) => {
        // Auto-start if nothing playing
        if (!prev.currentVideo) {
          return { currentVideo: { ...video, status: "playing", is_playing: true }, queue: prev.queue, history: prev.history };
        }
        return { ...prev, queue: [...prev.queue, video] };
      });
      opts?.onSuccess?.();
    },
  };

  const advanceQueue = {
    isPending: false,
    mutate: useCallback((_currentId?: string) => {
      setState((prev) => {
        const newHistory = prev.currentVideo
          ? [{ ...prev.currentVideo, status: "played" as VideoStatus, is_playing: false, played_at: new Date().toISOString() }, ...prev.history]
          : prev.history;
        const [next, ...rest] = prev.queue;
        return {
          currentVideo: next ? { ...next, status: "playing" as VideoStatus, is_playing: true } : null,
          queue: rest,
          history: newHistory.slice(0, 100),
        };
      });
    }, []),
  };

  const removeFromQueue = {
    isPending: false,
    mutate: useCallback((id: string) => {
      setState((prev) => ({
        ...prev,
        queue: prev.queue.filter((v) => v.id !== id),
        history: prev.history.filter((v) => v.id !== id),
      }));
    }, []),
  };

  const reorderQueue = {
    isPending: false,
    mutate: useCallback((orderedIds: string[]) => {
      setState((prev) => {
        const map = new Map(prev.queue.map((v) => [v.id, v]));
        const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean) as YouTubeVideo[];
        return { ...prev, queue: reordered };
      });
    }, []),
  };

  const toggleFavorite = {
    isPending: false,
    mutate: useCallback((data: { id: string; is_favorite: boolean }) => {
      const toggle = (v: YouTubeVideo) => v.id === data.id ? { ...v, is_favorite: data.is_favorite } : v;
      setState((prev) => ({
        currentVideo: prev.currentVideo ? toggle(prev.currentVideo) : null,
        queue: prev.queue.map(toggle),
        history: prev.history.map(toggle),
      }));
    }, []),
  };

  return {
    currentVideo,
    queue,
    recentVideos,
    isLoading: false,
    playNow,
    addToQueue,
    advanceQueue,
    removeFromQueue,
    reorderQueue,
    toggleFavorite,
  };
}
