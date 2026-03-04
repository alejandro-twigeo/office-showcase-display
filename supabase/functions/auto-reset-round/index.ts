import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/* ── Coordinate helpers ──────────────────────────────────── */
const TILE_ZOOM = 14;

function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

/* ── Difficulty seeds (mirrors client-side logic) ────────── */
const MAJOR_CITY_COORDS: [number, number][] = [
  [48.8566, 2.3522], [40.7128, -74.006], [35.6762, 139.6503],
  [51.5074, -0.1278], [-33.8688, 151.2093], [52.52, 13.405],
  [41.9028, 12.4964], [40.4168, -3.7038], [55.7558, 37.6173],
  [39.9042, 116.4074], [37.5665, 126.978], [13.7563, 100.5018],
  [-22.9068, -43.1729], [34.0522, -118.2437], [43.6532, -79.3832],
  [19.4326, -99.1332], [28.6139, 77.209], [1.3521, 103.8198],
  [31.2304, 121.4737], [59.3293, 18.0686], [50.0755, 14.4378],
  [47.4979, 19.0402], [38.7223, -9.1393], [37.9838, 23.7275],
  [41.0082, 28.9784], [33.8886, 35.4955], [-34.6037, -58.3816],
  [45.4642, 9.19], [48.2082, 16.3738], [35.6892, 51.389],
  [6.5244, 3.3792], [-1.2921, 36.8219], [14.5995, 120.9842],
  [21.0278, 105.8342], [30.0444, 31.2357], [25.2048, 55.2708],
  [-23.5505, -46.6333], [45.815, 15.9819], [42.6977, 23.3219],
  [44.4268, 26.1025],
];

const HARD_REGIONS: [number, number, number, number][] = [
  [35, 65, -10, 60], [10, 45, 60, 140], [-35, 15, 10, 50],
  [10, 55, -130, -60], [-55, 10, -80, -35], [-45, -10, 110, 175],
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomSeed(difficulty: number): { lat: number; lng: number } {
  if (difficulty === 1) {
    const c = pickRandom(MAJOR_CITY_COORDS);
    return { lat: c[0], lng: c[1] };
  }
  const r = pickRandom(HARD_REGIONS);
  return {
    lat: r[0] + Math.random() * (r[1] - r[0]),
    lng: r[2] + Math.random() * (r[3] - r[2]),
  };
}

const TILE_SPREAD: Record<number, number> = { 1: 0, 3: 8 };

/* ── Fetch thumb URL from graph API ──────────────────────── */
async function fetchThumbUrl(token: string, imageId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.mapillary.com/${imageId}?access_token=${token}&fields=thumb_2048_url`
    );
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    return data.thumb_2048_url || null;
  } catch { return null; }
}

/* ── Fetch image from Mapillary tiles (same as client) ───── */
async function fetchTileImageIds(
  token: string, tx: number, ty: number
): Promise<{ id: string; lat: number; lng: number }[]> {
  // Use the overview tile endpoint to get image IDs
  const url = `https://graph.mapillary.com/images?access_token=${token}&fields=id,geometry&bbox=${tileToBbox(tx, ty)}&limit=50`;
  try {
    const res = await fetch(url);
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    if (!data.data?.length) return [];
    return data.data.map((img: any) => ({
      id: String(img.id),
      lat: img.geometry.coordinates[1],
      lng: img.geometry.coordinates[0],
    }));
  } catch { return []; }
}

function tileToBbox(tx: number, ty: number): string {
  const n = 2 ** TILE_ZOOM;
  const west = (tx / n) * 360 - 180;
  const east = ((tx + 1) / n) * 360 - 180;
  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / n)));
  const north = (northRad * 180) / Math.PI;
  const south = (southRad * 180) / Math.PI;
  return `${west},${south},${east},${north}`;
}

/* ── Fetch a single image for a difficulty with retries ──── */
async function fetchImageForDifficulty(
  token: string, difficulty: number, maxRetries = 15
): Promise<{ lat: number; lng: number; thumb_url: string; mapillary_id: string }> {
  const spread = TILE_SPREAD[difficulty] ?? 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const seed = getRandomSeed(difficulty);
      const { x: cx, y: cy } = lngLatToTile(seed.lng, seed.lat, TILE_ZOOM);

      // Try multiple nearby tiles
      const tilesToTry = spread === 0
        ? [{ x: cx, y: cy }]
        : Array.from({ length: 6 }, () => ({
            x: cx + Math.floor(Math.random() * (spread * 2 + 1)) - spread,
            y: cy + Math.floor(Math.random() * (spread * 2 + 1)) - spread,
          }));

      const allImages: { id: string; lat: number; lng: number }[] = [];
      const results = await Promise.all(
        tilesToTry.map((t) => fetchTileImageIds(token, t.x, t.y))
      );
      for (const imgs of results) allImages.push(...imgs);

      if (allImages.length === 0) continue;

      // Try random images from batch
      const shuffled = allImages.sort(() => Math.random() - 0.5).slice(0, 5);
      for (const img of shuffled) {
        const thumbUrl = await fetchThumbUrl(token, img.id);
        if (thumbUrl) {
          return { lat: img.lat, lng: img.lng, thumb_url: thumbUrl, mapillary_id: img.id };
        }
      }
    } catch (e) {
      console.warn(`Attempt ${attempt + 1} for difficulty ${difficulty} failed:`, e);
    }
  }

  // Fallback: major cities
  for (let i = 0; i < 10; i++) {
    const city = pickRandom(MAJOR_CITY_COORDS);
    const { x, y } = lngLatToTile(city[1], city[0], TILE_ZOOM);
    const imgs = await fetchTileImageIds(token, x, y);
    if (imgs.length === 0) continue;
    const img = pickRandom(imgs);
    const thumbUrl = await fetchThumbUrl(token, img.id);
    if (thumbUrl) {
      return { lat: img.lat, lng: img.lng, thumb_url: thumbUrl, mapillary_id: img.id };
    }
  }

  throw new Error(`No Mapillary images found for difficulty ${difficulty} after all retries`);
}

/* ── Main handler ────────────────────────────────────────── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mapillaryToken = Deno.env.get("MAPILLARY_CLIENT_TOKEN")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Read schedule
  const { data: schedule, error: schedErr } = await supabase
    .from("round_schedule")
    .select("*")
    .eq("id", 1)
    .single();

  if (schedErr || !schedule) {
    return new Response(JSON.stringify({ error: "No schedule found" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!schedule.enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check Stockholm hour
  const nowStockholm = new Date().toLocaleString("en-US", { timeZone: "Europe/Stockholm" });
  const stockholmHour = new Date(nowStockholm).getHours();

  if (stockholmHour !== schedule.reset_hour) {
    return new Response(
      JSON.stringify({ skipped: true, reason: `current Stockholm hour ${stockholmHour} != ${schedule.reset_hour}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Prevent double-reset within the same hour
  if (schedule.last_auto_reset_at) {
    const lastReset = new Date(schedule.last_auto_reset_at);
    const diffMs = Date.now() - lastReset.getTime();
    if (diffMs < 55 * 60 * 1000) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "already reset this hour" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  try {
    // ── STEP 1: Fetch images FIRST (before any DB changes) ──
    console.log("Fetching Mapillary images for Easy and Hard...");
    const [easyImg, hardImg] = await Promise.all([
      fetchImageForDifficulty(mapillaryToken, 1),
      fetchImageForDifficulty(mapillaryToken, 3),
    ]);
    console.log("Images fetched successfully:", { easy: easyImg.mapillary_id, hard: hardImg.mapillary_id });

    // ── STEP 2: Now do all DB changes ──
    // Deactivate previous round
    await supabase.from("rounds").update({ is_active: false }).eq("is_active", true);

    // Create new round
    const { data: newRound, error: roundErr } = await supabase
      .from("rounds")
      .insert({ is_active: true })
      .select()
      .single();
    if (roundErr || !newRound) throw roundErr ?? new Error("Failed to create round");

    // Deactivate old locations for both difficulties
    await Promise.all([
      supabase.from("locations").update({ is_active: false }).eq("is_active", true).eq("difficulty", 1),
      supabase.from("locations").update({ is_active: false }).eq("is_active", true).eq("difficulty", 3),
    ]);

    // Create new locations with thumb URLs as pano_id (same as client-side)
    const { error: locErr } = await supabase.from("locations").insert([
      { lat: easyImg.lat, lng: easyImg.lng, pano_id: easyImg.thumb_url, difficulty: 1, is_active: true, round_id: newRound.id },
      { lat: hardImg.lat, lng: hardImg.lng, pano_id: hardImg.thumb_url, difficulty: 3, is_active: true, round_id: newRound.id },
    ]);
    if (locErr) throw locErr;

    // Update last_auto_reset_at
    await supabase.from("round_schedule").update({ last_auto_reset_at: new Date().toISOString() }).eq("id", 1);

    console.log("Auto-reset complete. Round:", newRound.id);
    return new Response(JSON.stringify({ success: true, round_id: newRound.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Auto-reset failed:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
