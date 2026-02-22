import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { Leaderboard } from "./Leaderboard";
import { useGuesses } from "@/hooks/useGuesses";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/difficulty";
import { fetchMapillaryRound } from "@/lib/mapillary";

const LOCAL_META_KEY = "wikiguess_meta";

interface StoredRoundMeta {
  roundId: string;
  mapillaryId: string;
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

const ZOOM_LEVELS = [6, 4.5, 3, 2, 1.5, 1];
const ZOOM_INTERVAL_MS = 30 * 60 * 1000;

function useTimedZoom(createdAt: string | null | undefined) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const [secondsUntilNext, setSecondsUntilNext] = useState<number | null>(null);

  useEffect(() => {
    if (!createdAt) {
      setZoomIndex(0);
      setSecondsUntilNext(null);
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - new Date(createdAt).getTime();
      const idx = Math.min(Math.floor(elapsed / ZOOM_INTERVAL_MS), ZOOM_LEVELS.length - 1);
      setZoomIndex(idx);

      if (idx < ZOOM_LEVELS.length - 1) {
        const nextAt = (idx + 1) * ZOOM_INTERVAL_MS;
        setSecondsUntilNext(Math.max(0, Math.ceil((nextAt - elapsed) / 1000)));
      } else {
        setSecondsUntilNext(null);
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  return { scale: ZOOM_LEVELS[zoomIndex], zoomIndex, secondsUntilNext };
}

export function StreetViewDisplay() {
  const { activeLocation, createNewLocation } = useActiveLocation();
  const { guesses } = useGuesses(activeLocation?.id);

  const creatingRef = useRef(false);
  const [isCreatingUi, setIsCreatingUi] = useState(false);
  const lastCreatedIdRef = useRef<string | null>(null);

  const { scale, zoomIndex, secondsUntilNext } = useTimedZoom(activeLocation?.created_at);

  const meta = useMemo(() => {
    const roundId = activeLocation?.id;
    if (!roundId) return null;
    return getStoredMeta(roundId);
  }, [activeLocation?.id]);

  const createRound = useCallback(
    async (difficulty: Difficulty = 1) => {
      if (creatingRef.current) return;
      creatingRef.current = true;
      setIsCreatingUi(true);

      try {
        const image = await fetchMapillaryRound(difficulty);

        createNewLocation.mutate(
          {
            lat: image.lat,
            lng: image.lng,
            pano_id: image.thumb_url,
            difficulty,
          },
          {
            onSuccess: (data: { id: string }) => {
              lastCreatedIdRef.current = data.id;
              localStorage.setItem(
                LOCAL_META_KEY,
                JSON.stringify({
                  roundId: data.id,
                  mapillaryId: image.id,
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
    },
    [createNewLocation]
  );

  return (
    <div className="h-full min-h-0 grid grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-[clamp(12px,1vw,18px)]">
      <Card className="h-full min-h-0 flex flex-col">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[clamp(20px,1.5vw,28px)]">
            <Globe className="h-[clamp(18px,1.2vw,26px)] w-[clamp(18px,1.2vw,26px)] text-primary" />
            Mystery location
            {activeLocation && (
              <Badge
                variant={
                  activeLocation.difficulty === 1
                    ? "default"
                    : activeLocation.difficulty === 2
                      ? "secondary"
                      : "destructive"
                }
                className="ml-2 text-[clamp(12px,0.8vw,14px)]"
              >
                {DIFFICULTY_LABELS[(activeLocation.difficulty || 1) as Difficulty]}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 flex flex-col gap-3">
          {activeLocation?.pano_id ? (
            <>
              <div className="relative w-full flex-1 min-h-0 overflow-hidden rounded-lg border bg-black">
                <img
                  src={activeLocation.pano_id}
                  alt="mystery"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000"
                  style={{ transform: `scale(${scale})` }}
                />
              </div>

              <div className="text-[clamp(12px,0.9vw,16px)] text-muted-foreground flex justify-between items-center gap-3">
                <span className="truncate">
                  {secondsUntilNext != null ? (
                    <>
                      🔍 Zoom {zoomIndex + 1}/{ZOOM_LEVELS.length} · Next clue in{" "}
                      {Math.floor(secondsUntilNext / 60)}:{String(secondsUntilNext % 60).padStart(2, "0")}
                    </>
                  ) : (
                    <>🔍 Max zoom reached</>
                  )}
                </span>

                {meta?.mapillaryId && (
                  <a
                    href={`https://www.mapillary.com/app/?pKey=${meta.mapillaryId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline truncate"
                  >
                    Mapillary source
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="text-center p-8">
              <Globe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No active round — start one from the Play page!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="h-full min-h-0">
        <Leaderboard guesses={guesses} />
      </div>
    </div>
  );
}
