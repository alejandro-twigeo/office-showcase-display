import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Binoculars, Brain } from "lucide-react";
import { JoinCard } from "./JoinCard";
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

type ActiveLocation = ReturnType<typeof useActiveLocation>["activeLocation"];

function MysteryCard({ activeLocation, label, fillHeight }: { activeLocation: ActiveLocation; label: string; fillHeight: boolean }) {
  const iconInfo = DIFFICULTY_ICON[label];

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
        <JoinCard />
      )}
    </Card>
  );
}

export function StreetViewDisplay({ forceDesktop = false }: { forceDesktop?: boolean }) {
  const { activeLocation: easy, isLoading: easyLoading } = useActiveLocation(1);
  const { activeLocation: hard, isLoading: hardLoading } = useActiveLocation(3);
  const noRounds = !easyLoading && !hardLoading && !easy?.pano_id && !hard?.pano_id;

  // No GeoGuessr rounds running: one invite card, leaderboards take the freed space
  if (noRounds) {
    return (
      <div
        className={`${
          forceDesktop ? "h-full min-h-0 grid grid-cols-3" : "h-full min-h-0 flex flex-col lg:grid lg:grid-cols-3"
        } gap-3 lg:gap-[clamp(12px,1vw,18px)]`}
      >
        <Card className={`${forceDesktop ? "h-full" : "h-[220px] lg:h-full"} min-h-0 flex flex-col p-0 overflow-hidden`}>
          <JoinCard />
        </Card>
        <div className={`${forceDesktop ? "h-full min-h-0" : "min-h-[220px] lg:h-full lg:min-h-0"} lg:col-span-2 ${forceDesktop ? "col-span-2" : ""}`}>
          <RotatingLeaderboard wide />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        forceDesktop
          ? "h-full min-h-0 grid grid-cols-3"
          : "h-full min-h-0 flex flex-col lg:grid lg:grid-cols-3"
      } gap-3 lg:gap-[clamp(12px,1vw,18px)]`}
    >
      <MysteryCard activeLocation={easy} label="Easy" fillHeight={forceDesktop} />
      <MysteryCard activeLocation={hard} label="Hard" fillHeight={forceDesktop} />
      <div className={`${forceDesktop ? "h-full min-h-0" : "min-h-[220px] lg:h-full lg:min-h-0"}`}>
        <RotatingLeaderboard />
      </div>
    </div>
  );
}
