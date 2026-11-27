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
        // The function says why it failed in its response; show that instead of "non-2xx status code"
        let reason = "";
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = await (error as any).context?.json?.();
          reason = typeof body?.error === "string" ? body.error : "";
        } catch {
          /* no readable body */
        }
        throw new Error(friendlySearchError(reason || error.message));
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

/** Turn YouTube's and the server's error messages into something people can act on */
function friendlySearchError(raw: string) {
  const r = raw.toLowerCase();
  if (r.includes("quota")) return "YouTube's search limit for today is used up. Paste a YouTube link instead.";
  if (r.includes("api key") || r.includes("youtube_api_key") || r.includes("keyinvalid") || r.includes("api_key"))
    return "YouTube search isn't set up right now (the search key isn't working). Paste a YouTube link instead.";
  if (r.includes("daily search limit")) return raw;
  if (r.includes("non-2xx") || r.includes("failed to send") || r.includes("fetch"))
    return "Search isn't reachable right now. Paste a YouTube link instead.";
  return raw || "YouTube search failed. Paste a YouTube link instead.";
}
