import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
}

interface YouTubeSearchResponse {
  results: YouTubeSearchResult[];
  cached: boolean;
  remainingSearches: number;
}

export function useYouTubeSearch() {
  return useMutation<YouTubeSearchResponse, Error, { query: string; deviceId: string }>({
    mutationFn: async ({ query, deviceId }) => {
      const { data, error } = await supabase.functions.invoke("youtube-search", {
        body: { query, deviceId },
      });

      if (error) {
        throw new Error(error.message || "YouTube search failed");
      }

      if (!data || typeof data !== "object") {
        throw new Error("Unexpected search response");
      }

      if ("error" in data && typeof data.error === "string") {
        throw new Error(data.error);
      }

      return data as YouTubeSearchResponse;
    },
  });
}
