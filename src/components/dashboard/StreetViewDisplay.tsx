import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { Leaderboard } from "./Leaderboard";
import { useGuesses } from "@/hooks/useGuesses";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_LABELS, DIFFICULTY_LOCATIONS, type Difficulty } from "@/lib/difficulty";

const LOCAL_META_KEY = "wikiguess_meta";

interface StoredRoundMeta {
  roundId: string;
  sourceUrl: string;
  answerTitle: string;
}

// Use shared difficulty config for candidate titles
function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getStoredMeta(roundId: string): StoredRoundMeta | null {
  try {
    const raw = localStorage.getItem(LOCAL_META_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredRoundMeta | null;
    if (!parsed || parsed.roundId !== roundId) return null;

    return parsed;
  } catch {
    return null;
  }
}

async function fetchWikiRound(title: string) {
  const url =
    "https://en.wikipedia.org/w/api.php" +
    "?action=query" +
    "&format=json" +
    "&origin=*" +
    "&prop=coordinates|pageimages|info" +
    "&inprop=url" +
    "&piprop=thumbnail" +
    "&pithumbsize=1280" +
    "&titles=" +
    encodeURIComponent(title);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia fetch failed: ${res.status}`);

  const data = await res.json();
  const pages = data?.query?.pages;
  const page = pages ? pages[Object.keys(pages)[0]] : null;

  const coord = page?.coordinates?.[0];
  const thumb = page?.thumbnail?.source;
  const pageUrl = page?.fullurl;

  if (!coord || !thumb || !pageUrl) {
    throw new Error(`Missing coord/thumb for "${title}"`);
  }

  return {
    lat: coord.lat as number,
    lng: coord.lon as number,
    imageUrl: thumb as string,
    sourceUrl: pageUrl as string,
    answerTitle: page.title as string,
  };
}

async function fetchRandomWikiRoundWithRetry(difficulty: Difficulty = 1, maxTries = 12) {
  let lastErr: unknown = null;
  const titles = DIFFICULTY_LOCATIONS[difficulty];

  for (let i = 0; i < maxTries; i++) {
    try {
      const title = pickRandom(titles);
      return await fetchWikiRound(title);
    } catch (e) {
      lastErr = e;
    }
  }

  // fallback
  return await fetchWikiRound("Eiffel Tower").catch(() => {
    throw lastErr ?? new Error("Failed to fetch a wiki round");
  });
}

// Zoom levels: starts at 6x, zooms out one step every 30 min
const ZOOM_LEVELS = [6, 4.5, 3, 2, 1.5, 1];
const ZOOM_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

function useTimedZoom(createdAt: string | null | undefined) {
  const [zoomIndex, setZoomIndex] = useState(0);

  useEffect(() => {
    if (!createdAt) { setZoomIndex(0); return; }

    const calcIndex = () => {
      const elapsed = Date.now() - new Date(createdAt).getTime();
      const idx = Math.floor(elapsed / ZOOM_INTERVAL_MS);
      return Math.min(idx, ZOOM_LEVELS.length - 1);
    };

    setZoomIndex(calcIndex());
    const id = setInterval(() => setZoomIndex(calcIndex()), 60_000); // check every minute
    return () => clearInterval(id);
  }, [createdAt]);

  return ZOOM_LEVELS[zoomIndex];
}

export function StreetViewDisplay() {
  const { activeLocation, createNewLocation } = useActiveLocation();
  const { guesses } = useGuesses(activeLocation?.id);

  const creatingRef = useRef(false);
  const [isCreatingUi, setIsCreatingUi] = useState(false);

  const scale = useTimedZoom(activeLocation?.created_at);

  const meta = useMemo(() => {
    const roundId = activeLocation?.id;
    if (!roundId) return null;
    return getStoredMeta(roundId);
  }, [activeLocation?.id]);

  const createRound = useCallback(async (difficulty: Difficulty = 1) => {
    if (creatingRef.current || createNewLocation.isPending) return;
    creatingRef.current = true;
    setIsCreatingUi(true);

    try {
      const round = await fetchRandomWikiRoundWithRetry(difficulty);

      if (!round.imageUrl || typeof round.lat !== "number" || typeof round.lng !== "number") {
        throw new Error("Invalid round data");
      }

      createNewLocation.mutate(
        {
          lat: round.lat,
          lng: round.lng,
          pano_id: round.imageUrl,
          difficulty,
        },
        {
          onSuccess: (data: { id: string }) => {
            localStorage.setItem(
              LOCAL_META_KEY,
              JSON.stringify({
                roundId: data.id,
                sourceUrl: round.sourceUrl,
                answerTitle: round.answerTitle,
              })
            );
            creatingRef.current = false;
            setIsCreatingUi(false);
          },
          onError: () => {
            creatingRef.current = false;
            setIsCreatingUi(false);
          },
        }
      );
    } catch (err) {
      console.error("Round creation failed", err);
      creatingRef.current = false;
      setIsCreatingUi(false);
    }
  }, [createNewLocation]);

  // Auto-create a round if none exists or if pano_id is missing
  useEffect(() => {
    if (!activeLocation || !activeLocation.pano_id) {
      void createRound();
    }
  }, [activeLocation?.id, activeLocation?.pano_id, createRound]);

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      <div className="col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />
              Mystery location
              {activeLocation && (
                <Badge variant={activeLocation.difficulty === 1 ? "default" : activeLocation.difficulty === 2 ? "secondary" : "destructive"} className="ml-2">
                  {DIFFICULTY_LABELS[(activeLocation.difficulty || 1) as Difficulty]}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col gap-3">
            {activeLocation?.pano_id ? (
              <>
                <div className="relative w-full flex-1 min-h-[360px] overflow-hidden rounded-lg border bg-black">
                  <img
                    src={activeLocation.pano_id}
                    alt="mystery"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000"
                    style={{ transform: `scale(${scale})` }}
                  />
                </div>

                <div className="text-xs text-muted-foreground flex justify-between items-center gap-3">
                  <span className="truncate">ID: {activeLocation.id.slice(0, 8)}...</span>

                  {meta?.sourceUrl ? (
                    <a
                      href={meta.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline truncate"
                    >
                      Wiki source
                    </a>
                  ) : (
                    <span className="truncate">Wiki source</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center p-8">
                <Globe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Creating a round...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="col-span-1">
        <Leaderboard guesses={guesses} />
      </div>
    </div>
  );
}
