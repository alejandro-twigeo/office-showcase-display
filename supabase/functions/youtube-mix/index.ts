import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * YouTube Mix: keeps "Up next" at 10 songs, so the music never runs out.
 *
 * The TV calls this whenever a song starts and fewer than 10 songs are waiting. We read YouTube's
 * own Mix (the "Mix" list YouTube shows next to a video) for the song playing now, and for the last
 * songs people queued themselves, so the picks follow the room's taste, not just one song. New songs
 * are added as "🎵 YouTube Mix" until 10 are waiting. People can skip them like any other song.
 *
 * People's songs always play first: Mix songs get a queue time a week ahead, so anything a person
 * adds (queued "now") sorts before them. Dragging the queue on the TV still sets any order you like.
 *
 * No YouTube API key or search quota: it reads the public watch page, like the playlist import.
 */

const MIX_BY = "🎵 YouTube Mix";
const TARGET = 10; // songs waiting in "Up next"
const AVOID_HOURS = 12; // don't repeat anything queued in this window
const BEHIND_PEOPLE_MS = 7 * 24 * 3_600_000; // Mix songs sort after anything a person queues

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** The video ids in YouTube's Mix for one song (empty if YouTube didn't answer) */
async function mixFor(seed: string): Promise<string[]> {
  try {
    // The cookies skip the EU consent page
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
    return ids;
  } catch {
    return [];
  }
}

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

    // How many are waiting now
    const { count: waiting } = await supabase
      .from("youtube_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued")
      .or(notDeleted);
    const need = TARGET - (waiting ?? 0);
    if (need <= 0) return json({ added: 0, reason: "queue is full" });

    // Several screens can ask at the same moment: one top-up a minute is enough
    const { count: justAdded } = await supabase
      .from("youtube_queue")
      .select("id", { count: "exact", head: true })
      .eq("queued_by", MIX_BY)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((justAdded ?? 0) > 0) return json({ added: 0, reason: "just topped up" });

    // Everything from the last few hours (so nothing repeats), and what people chose themselves
    const { data: recent } = await supabase
      .from("youtube_queue")
      .select("video_id, queued_by, created_at")
      .gte("created_at", new Date(Date.now() - AVOID_HOURS * 3_600_000).toISOString())
      .order("created_at", { ascending: false });
    const rows = (recent ?? []) as { video_id: string; queued_by: string }[];
    const avoid = new Set<string>([seed, ...rows.map((r) => r.video_id)]);
    // Seeds: the song playing now, then the last two songs people queued
    const peoplePicks = rows.filter((r) => r.queued_by !== MIX_BY).map((r) => r.video_id);
    const seeds = Array.from(new Set([seed, ...peoplePicks])).slice(0, 3);

    // Take candidates from each seed's Mix in turn, so the picks blend the room's taste
    const lists = await Promise.all(seeds.map(mixFor));
    const candidates: string[] = [];
    for (let i = 0; candidates.length < need * 2 && lists.some((l) => i < l.length); i++) {
      for (const l of lists) {
        const id = l[i];
        if (id && !avoid.has(id) && !candidates.includes(id)) candidates.push(id);
      }
    }

    // Titles and thumbnails; oEmbed also fails for videos that can't play outside YouTube, so those drop out
    const metas = await Promise.all(
      candidates.map(async (id) => {
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

    // After everything already waiting (including earlier Mix songs), and after anything a person adds later
    const { data: lastMix } = await supabase
      .from("youtube_queue")
      .select("queued_at")
      .eq("status", "queued")
      .eq("queued_by", MIX_BY)
      .order("queued_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const base = Math.max(Date.now() + BEHIND_PEOPLE_MS, lastMix?.queued_at ? Date.parse(lastMix.queued_at) + 1000 : 0);
    const add = metas
      .filter((m): m is { id: string; title: string; thumb: string } => !!m)
      .slice(0, need)
      .map((m, i) => ({
        video_id: m.id,
        title: m.title,
        thumbnail_url: m.thumb,
        queued_by: MIX_BY,
        is_playing: false,
        is_favorite: false,
        is_deleted: false,
        status: "queued",
        queued_at: new Date(base + i * 1000).toISOString(), // keeps the Mix order
      }));
    if (add.length === 0) return json({ added: 0, reason: "no mix found" });

    const { error } = await supabase.from("youtube_queue").insert(add);
    if (error) throw error;
    return json({ added: add.length });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
