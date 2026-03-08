import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Globe, Binoculars, Brain } from "lucide-react";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { RotatingLeaderboard } from "./RotatingLeaderboard";

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

const DIFFICULTY_ICON: Record<string, { icon: typeof Binoculars; colorClass: string }> = {
  Easy: { icon: Binoculars, colorClass: "text-primary" },
  Hard: { icon: Brain, colorClass: "text-destructive" },
};

function MysteryCard({ difficulty, label, fillHeight }: { difficulty: number; label: string; fillHeight: boolean }) {
  const iconInfo = DIFFICULTY_ICON[label];
  const { activeLocation } = useActiveLocation(difficulty);

  const meta = useMemo(() => {
    if (!activeLocation?.id) return null;
    return getStoredMeta(activeLocation.id);
  }, [activeLocation?.id]);

  return (
    <Card className={`${fillHeight ? "h-full" : "h-[180px] lg:h-full"} min-h-0 flex flex-col p-0 overflow-hidden`}>
      {activeLocation?.pano_id ? (
        <div className="relative w-full flex-1 min-h-0">
          <img src={activeLocation.pano_id} alt={`${label} GeoGuess location`} className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-background/80 backdrop-blur-sm text-[clamp(11px,0.8vw,14px)] font-medium text-foreground flex items-center gap-1">
            {iconInfo && <iconInfo.icon className={`h-[clamp(12px,0.9vw,16px)] w-[clamp(12px,0.9vw,16px)] ${iconInfo.colorClass}`} />}
            {label}
          </span>
          {meta?.mapillaryId && (
            <a
              href={`https://www.mapillary.com/app/?pKey=${meta.mapillaryId}`}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-1.5 right-2 text-[clamp(9px,0.6vw,12px)] text-primary-foreground/80 underline"
            >
              Mapillary
            </a>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-[clamp(12px,0.8vw,16px)] text-muted-foreground">No active {label.toLowerCase()} round</p>
          </div>
        </div>
      )}
    </Card>
  );
}

export function StreetViewDisplay({ forceDesktop = false }: { forceDesktop?: boolean }) {
  return (
    <div
      className={`${
        forceDesktop
          ? "h-full min-h-0 grid grid-cols-3"
          : "h-full min-h-0 flex flex-col lg:grid lg:grid-cols-3"
      } gap-3 lg:gap-[clamp(12px,1vw,18px)]`}
    >
      <MysteryCard difficulty={1} label="Easy" fillHeight={forceDesktop} />
      <MysteryCard difficulty={3} label="Hard" fillHeight={forceDesktop} />
      <div className={`${forceDesktop ? "h-full min-h-0" : "min-h-[220px] lg:h-full lg:min-h-0"}`}>
        <RotatingLeaderboard />
      </div>
    </div>
  );
}
