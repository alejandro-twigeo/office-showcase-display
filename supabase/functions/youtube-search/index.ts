import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_LIMIT = 25;
const CACHE_HOURS = 24;
const MAX_RESULTS = 4;

type SearchResult = {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, deviceId } = await req.json();

    if (typeof query !== "string" || typeof deviceId !== "string" || !deviceId.trim()) {
      return json({ error: "query and deviceId are required" }, 400);
    }

    const normalizedQuery = normalizeQuery(query);
    if (normalizedQuery.length < 3) {
      return json({ error: "Search query must be at least 3 characters." }, 400);
    }

    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      return json({ error: "YOUTUBE_API_KEY is not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    const { data: cached } = await supabase
      .from("youtube_search_cache")
      .select("results")
      .eq("normalized_query", normalizedQuery)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (cached?.results) {
      await supabase
        .from("youtube_search_cache")
        .update({ last_used_at: nowIso })
        .eq("normalized_query", normalizedQuery);

      const { data: usage } = await supabase
        .from("youtube_search_usage")
        .select("search_count")
        .eq("device_id", deviceId)
        .eq("search_date", today)
        .maybeSingle();

      return json({
        results: cached.results,
        cached: true,
        remainingSearches: Math.max(0, DAILY_LIMIT - (usage?.search_count ?? 0)),
      });
    }

    const { data: usage } = await supabase
      .from("youtube_search_usage")
      .select("id, search_count")
      .eq("device_id", deviceId)
      .eq("search_date", today)
      .maybeSingle();

    const currentCount = usage?.search_count ?? 0;
    if (currentCount >= DAILY_LIMIT) {
      return json(
        { error: `Daily search limit reached (${DAILY_LIMIT}). Paste a link instead.` },
        429,
      );
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", String(MAX_RESULTS));
    url.searchParams.set("q", query.trim());
    url.searchParams.set(
      "fields",
      "items(id/videoId,snippet/title,snippet/channelTitle,snippet/publishedAt,snippet/thumbnails/default/url,snippet/thumbnails/medium/url)",
    );
    url.searchParams.set("key", apiKey);

    const ytResponse = await fetch(url.toString());
    const ytData = await ytResponse.json();

    if (!ytResponse.ok) {
      const message = ytData?.error?.message ?? "YouTube search failed";
      return json({ error: message }, ytResponse.status);
    }

    const results: SearchResult[] = (ytData.items ?? [])
      .map((item: any) => ({
        videoId: item?.id?.videoId ?? "",
        title: item?.snippet?.title ?? "Untitled video",
        thumbnailUrl: item?.snippet?.thumbnails?.medium?.url ?? item?.snippet?.thumbnails?.default?.url ?? null,
        channelTitle: item?.snippet?.channelTitle ?? null,
        publishedAt: item?.snippet?.publishedAt ?? null,
      }))
      .filter((item: SearchResult) => item.videoId);

    const expiresAt = new Date(Date.now() + CACHE_HOURS * 60 * 60 * 1000).toISOString();

    await supabase.from("youtube_search_cache").upsert(
      {
        normalized_query: normalizedQuery,
        results,
        expires_at: expiresAt,
        last_used_at: nowIso,
      },
      { onConflict: "normalized_query" },
    );

    if (usage?.id) {
      await supabase
        .from("youtube_search_usage")
        .update({ search_count: currentCount + 1, updated_at: nowIso })
        .eq("id", usage.id);
    } else {
      await supabase.from("youtube_search_usage").insert({
        device_id: deviceId,
        search_date: today,
        search_count: 1,
        updated_at: nowIso,
      });
    }

    return json({
      results,
      cached: false,
      remainingSearches: DAILY_LIMIT - (currentCount + 1),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
