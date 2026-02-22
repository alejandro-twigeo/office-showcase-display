import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { Leaderboard } from "./Leaderboard";
import { useGuesses } from "@/hooks/useGuesses";
import { Badge } from "@/components/ui/badge";

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

/** Single mystery image card */
function MysteryCard({ difficulty, label, color }: { difficulty: number; label: string; color: string }) {
  const { activeLocation } = useActiveLocation(difficulty);

  const meta = useMemo(() => {
    if (!activeLocation?.id) return null;
    return getStoredMeta(activeLocation.id);
  }, [activeLocation?.id]);

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-2 flex-row items-center gap-2">
        <CardTitle className="flex items-center gap-2 text-[clamp(16px,1.2vw,22px)]">
          <Globe className="h-[clamp(14px,1vw,20px)] w-[clamp(14px,1vw,20px)] text-primary" />
          {label}
        </CardTitle>
        <Badge variant={color === 'green' ? 'default' : 'destructive'} className="text-[clamp(10px,0.7vw,12px)]">
          {label}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-2">
        {activeLocation?.pano_id ? (
          <>
            <div className="relative w-full flex-1 min-h-0 overflow-hidden rounded-lg border bg-black">
              <img src={activeLocation.pano_id} alt="mystery" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            {meta?.mapillaryId && (
              <a href={`https://www.mapillary.com/app/?pKey=${meta.mapillaryId}`}
                target="_blank" rel="noreferrer"
                className="text-[clamp(10px,0.7vw,14px)] text-muted-foreground underline truncate">
                Mapillary source
              </a>
            )}
          </>
        ) : (
          <div className="text-center flex-1 flex items-center justify-center">
            <div>
              <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-[clamp(12px,0.8vw,16px)] text-muted-foreground">
                No active {label.toLowerCase()} round
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StreetViewDisplay() {
  const { activeLocation: easyLocation } = useActiveLocation(1);
  const { activeLocation: hardLocation } = useActiveLocation(3);
  const { guesses: easyGuesses } = useGuesses(easyLocation?.id);
  const { guesses: hardGuesses } = useGuesses(hardLocation?.id);

  return (
    <div className="h-full min-h-0 grid grid-cols-[1fr_1fr_minmax(320px,1fr)] gap-[clamp(12px,1vw,18px)]">
      <MysteryCard difficulty={1} label="Easy" color="green" />
      <MysteryCard difficulty={3} label="Hard" color="red" />
      <div className="h-full min-h-0">
        <Leaderboard easyGuesses={easyGuesses} hardGuesses={hardGuesses} />
      </div>
    </div>
  );
}
