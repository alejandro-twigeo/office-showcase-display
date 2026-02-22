import Pbf from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import { supabase } from "@/integrations/supabase/client";
import {
  type Difficulty,
  getRandomSeed,
  MAJOR_CITY_COORDS,
} from "./difficulty";

export interface MapillaryImage {
  id: string;
  lat: number;
  lng: number;
  thumb_url: string;
}

/* ── Token cache (expires after 5 min to pick up secret rotations) ── */
let _cachedToken: string | null = null;
let _tokenFetchedAt = 0;
const TOKEN_TTL_MS = 5 * 60 * 1000;

async function getToken(): Promise<string> {
  if (_cachedToken && Date.now() - _tokenFetchedAt < TOKEN_TTL_MS) return _cachedToken;
  const { data, error } = await supabase.functions.invoke("mapillary-search");
  if (error || !data?.token) throw new Error("Could not retrieve Mapillary token");
  _cachedToken = data.token;
  _tokenFetchedAt = Date.now();
  return _cachedToken!;
}

/* ── Coordinate ↔ tile helpers ───────────────────────────── */
const TILE_ZOOM = 14;

function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

/* ── Tile image with coords extracted from tile geometry ─── */
interface TileImage {
  id: string;
  lat: number;
  lng: number;
}

async function fetchTileImages(
  token: string,
  tx: number,
  ty: number,
): Promise<TileImage[]> {
  const url = `https://tiles.mapillary.com/maps/vtp/mly1_public/2/${TILE_ZOOM}/${tx}/${ty}?access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const buf = await res.arrayBuffer();
  const tile = new VectorTile(new Pbf(buf));

  const layer = tile.layers["image"];
  if (!layer) return [];

  const images: TileImage[] = [];
  for (let i = 0; i < layer.length; i++) {
    const feat = layer.feature(i);
    const id = feat.properties["id"] ?? feat.id;
    if (id == null) continue;

    // Extract real-world coordinates from the tile feature
    const geojson = feat.toGeoJSON(tx, ty, TILE_ZOOM) as any;
    const coords = geojson.geometry?.coordinates as number[] | undefined;
    if (!coords || coords.length < 2) continue;

    images.push({
      id: String(id),
      lng: coords[0],
      lat: coords[1],
    });
  }
  return images;
}

/* ── Fetch thumbnail URL from graph API ──────────────────── */
async function fetchThumbUrl(
  token: string,
  imageId: string,
): Promise<string | null> {
  // Use access_token as query param (same auth style as tiles endpoint)
  const url = `https://graph.mapillary.com/${imageId}?access_token=${token}&fields=thumb_2048_url`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumb_2048_url || null;
  } catch {
    return null;
  }
}

/* ── Helpers ─────────────────────────────────────────────── */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TILE_SPREAD: Record<Difficulty, number> = {
  1: 0,
  2: 2,
  3: 8,
};

/* ── Public entry point ──────────────────────────────────── */
export async function fetchMapillaryRound(
  difficulty: Difficulty,
  maxRetries = 10,
): Promise<MapillaryImage> {
  const token = await getToken();
  const spread = TILE_SPREAD[difficulty];
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const seed = getRandomSeed(difficulty);
      const { x: cx, y: cy } = lngLatToTile(seed.lng, seed.lat, TILE_ZOOM);

      const tilesToTry = spread === 0
        ? [{ x: cx, y: cy }]
        : Array.from({ length: 4 }, () => ({
            x: cx + Math.floor(Math.random() * (spread * 2 + 1)) - spread,
            y: cy + Math.floor(Math.random() * (spread * 2 + 1)) - spread,
          }));

      const allImages: TileImage[] = [];
      const results = await Promise.all(
        tilesToTry.map((t) => fetchTileImages(token, t.x, t.y))
      );
      for (const imgs of results) allImages.push(...imgs);

      if (allImages.length === 0) continue;

      // Try up to 5 random images from this batch
      const shuffled = allImages.sort(() => Math.random() - 0.5).slice(0, 5);
      for (const img of shuffled) {
        const thumbUrl = await fetchThumbUrl(token, img.id);
        if (thumbUrl) {
          return { id: img.id, lat: img.lat, lng: img.lng, thumb_url: thumbUrl };
        }
      }
    } catch (e) {
      lastErr = e;
      console.warn(`Mapillary attempt ${attempt + 1} failed:`, e);
    }
  }

  // Fallback: try known major cities
  for (let i = 0; i < 5; i++) {
    try {
      const city = pickRandom(MAJOR_CITY_COORDS);
      const { x, y } = lngLatToTile(city[1], city[0], TILE_ZOOM);
      const imgs = await fetchTileImages(token, x, y);
      if (imgs.length === 0) continue;
      const img = pickRandom(imgs);
      const thumbUrl = await fetchThumbUrl(token, img.id);
      if (thumbUrl) {
        return { id: img.id, lat: img.lat, lng: img.lng, thumb_url: thumbUrl };
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr ?? new Error("No Mapillary images found after all retries");
}
