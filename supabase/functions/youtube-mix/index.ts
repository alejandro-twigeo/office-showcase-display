import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * YouTube Mix: keeps the music going when the queue runs out.
 *
 * The TV calls this when the last queued song starts playing. We read YouTube's own Mix for that
 * song (the same "Mix" list YouTube shows next to a video), take the next few songs that haven't
 * played recently, and add them to the queue as "🎵 YouTube Mix". People can skip them like any
 * other song, and anything a person queues still plays first (it's added at the end as usual).
 *
 * No YouTube API key or search quota: it reads the public watch page, like the playlist import.
 */

const MIX_BY = "🎵 YouTube Mix";
const ADD = 5; // songs per top-up
const AVOID_HOURS = 12; // don't repeat anything queued in this window

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    let seed = new URL(req.url).searchParams.get("seed") ?? "";
    if (!seed && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      seed = typeof body?.seed === "string" ? body.seed : "";
    }
    if (!/^[\w-]{11}$/.test(seed)) return json({ error: "seed (a YouTube video id) is required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const notDeleted = "is_deleted.is.null,is_deleted.eq.false";

    // Only when nothing is waiting: a person's songs always come first
    const { count: waiting } = await supabase
      .from("youtube_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .or(notDeleted);
    if ((waiting ?? 0) > 0) return json({ added: 0, reason: "queue not empty" });

    // Several screens can ask at the same moment: one top-up a minute is enough
    const { count: justAdded } = await supabase
      .from("youtube_queue")
      .select("id", { count: "exact", head: true })
      .eq("queued_by", MIX_BY)
      .gte("queued_at", new Date(Date.now() - 60_000).toISOString());
    if ((justAdded ?? 0) > 0) return json({ added: 0, reason: "just topped up" });

    // Songs from the last few hours, so the mix doesn't repeat them
    const { data: recent } = await supabase
      .from("youtube_queue")
      .select("video_id")
      .gte("queued_at", new Date(Date.now() - AVOID_HOURS * 3_600_000).toISOString());
    const avoid = new Set<string>([seed, ...(recent ?? []).map((r: { video_id: string }) => r.video_id)]);

    // YouTube's Mix for this song. The cookies skip the EU consent page.
    const res = await fetch(`https://www.youtube.com/watch?v=${seed}&list=RD${seed}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+cb; SOCS=CAI",
      },
    });
    const html = await res.text();
    // The Mix list itself; if YouTube changes its page, fall back to the related videos on it
    let ids = Array.from(html.matchAll(/"playlistPanelVideoRenderer":\{.*?"videoId":"([\w-]{11})"/g), (m) => m[1]);
    if (ids.length === 0) ids = Array.from(html.matchAll(/"videoId":"([\w-]{11})"/g), (m) => m[1]);
    const picks = Array.from(new Set(ids)).filter((id) => !avoid.has(id)).slice(0, ADD * 2);

    // Titles and thumbnails; oEmbed also fails for videos that can't play outside YouTube, so those drop out
    const metas = await Promise.all(
      picks.map(async (id) => {
        try {
          const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
          if (!r.ok) return null;
          const j = await r.json();
          return { id, title: String(j?.title ?? `Video ${id}`), thumb: String(j?.thumbnail_url ?? `https://img.youtube.com/vi/${id}/hqdefault.jpg`) };
        } catch {
          return null;
        }
      }),
    );
    const now = Date.now();
    const rows = metas
      .filter((m): m is { id: string; title: string; thumb: string } => !!m)
      .slice(0, ADD)
      .map((m, i) => ({
        video_id: m.id,
        title: m.title,
        thumbnail_url: m.thumb,
        queued_by: MIX_BY,
        is_playing: false,
        is_favorite: false,
        is_deleted: false,
        status: "queued",
        queued_at: new Date(now + i * 1000).toISOString(), // keeps the Mix order
      }));
    if (rows.length === 0) return json({ added: 0, reason: "no mix found" });

    const { error } = await supabase.from("youtube_queue").insert(rows);
    if (error) throw error;
    return json({ added: rows.length });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
