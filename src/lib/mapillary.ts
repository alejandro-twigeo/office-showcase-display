import { supabase } from "@/integrations/supabase/client";
import {
  type Difficulty,
  DIFFICULTY_BBOX_SIZE,
  getRandomSeed,
  MAJOR_CITY_COORDS,
} from "./difficulty";

export interface MapillaryImage {
  id: string;
  lat: number;
  lng: number;
  thumb_url: string;
}

async function searchImages(lat: number, lng: number, radius: number): Promise<MapillaryImage[]> {
  const { data, error } = await supabase.functions.invoke("mapillary-search", {
    body: { lat, lng, radius, limit: 30 },
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Mapillary search failed");
  return data.images as MapillaryImage[];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Radius in meters per difficulty */
const SEARCH_RADIUS: Record<Difficulty, number> = {
  1: 2000,   // 2km around major cities
  2: 3000,   // 3km in populated areas
  3: 4000,   // 4km in remote areas
};

/**
 * Fetch a random street-level image from Mapillary for the given difficulty.
 * Retries up to `maxRetries` times with different random seeds.
 */
export async function fetchMapillaryRound(
  difficulty: Difficulty,
  maxRetries = 10
): Promise<MapillaryImage> {
  const radius = SEARCH_RADIUS[difficulty];
  let lastErr: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const seed = getRandomSeed(difficulty);
      const images = await searchImages(seed.lat, seed.lng, radius);
      if (images.length > 0) {
        return pickRandom(images);
      }
    } catch (e) {
      lastErr = e;
      console.warn(`Mapillary attempt ${i + 1} failed:`, e);
    }
  }

  // Fallback: try known major cities
  for (let i = 0; i < 5; i++) {
    const city = pickRandom(MAJOR_CITY_COORDS);
    try {
      const images = await searchImages(city[0], city[1], 2000);
      if (images.length > 0) return pickRandom(images);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr ?? new Error("No Mapillary images found after all retries");
}
