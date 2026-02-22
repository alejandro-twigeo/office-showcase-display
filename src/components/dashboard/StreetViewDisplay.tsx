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
    <Card className="h-full min-h-0 flex flex-col p-0 overflow-hidden">
      {activeLocation?.pano_id ? (
        <div className="relative w-full flex-1 min-h-0">
          <img src={activeLocation.pano_id} alt="mystery" className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-white/70 backdrop-blur-sm text-[clamp(11px,0.8vw,14px)] font-medium text-foreground">
            {label}
          </span>
          {meta?.mapillaryId && (
            <a href={`https://www.mapillary.com/app/?pKey=${meta.mapillaryId}`}
              target="_blank" rel="noreferrer"
              className="absolute bottom-1.5 right-2 text-[clamp(9px,0.6vw,12px)] text-white/70 underline">
              Mapillary
            </a>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-[clamp(12px,0.8vw,16px)] text-muted-foreground">
              No active {label.toLowerCase()} round
            </p>
          </div>
        </div>
      )}
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
