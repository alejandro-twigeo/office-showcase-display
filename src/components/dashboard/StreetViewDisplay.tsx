import { Card } from "@/components/ui/card";
import { Binoculars, Brain, Globe2 } from "lucide-react";
import { JoinCard } from "./JoinCard";
import { useActiveLocation } from "@/hooks/useActiveLocation";
import { RotatingLeaderboard } from "./RotatingLeaderboard";

type ActiveLocation = ReturnType<typeof useActiveLocation>["activeLocation"];

const LEVELS = {
  Easy: { icon: Binoculars, colorClass: "text-primary" },
  Hard: { icon: Brain, colorClass: "text-destructive" },
} as const;

function GeoPhoto({ location, level }: { location: NonNullable<ActiveLocation>; level: keyof typeof LEVELS }) {
  const { icon: Icon, colorClass } = LEVELS[level];
  return (
    <div className="relative min-w-0 min-h-0 overflow-hidden rounded-[clamp(8px,0.6vw,12px)] bg-secondary">
      <img src={location.pano_id!} alt={`${level} GeoGuessr location`} className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute left-[clamp(6px,0.5vw,10px)] top-[clamp(6px,0.5vw,10px)] flex items-center gap-1 rounded-full bg-background px-[clamp(8px,0.6vw,12px)] py-[clamp(2px,0.2vw,4px)] text-[clamp(11px,0.8vw,16px)] font-semibold text-foreground shadow-sm">
        <Icon className={`h-[clamp(12px,0.9vw,18px)] w-[clamp(12px,0.9vw,18px)] ${colorClass}`} />
        {level}
      </span>
    </div>
  );
}

/** Both GeoGuessr photos in one tile, so the game gets one slot instead of two. */
function GeoCard({ easy, hard, fillHeight }: { easy: ActiveLocation; hard: ActiveLocation; fillHeight: boolean }) {
  const photos = [
    easy?.pano_id ? { location: easy, level: "Easy" as const } : null,
    hard?.pano_id ? { location: hard, level: "Hard" as const } : null,
  ].filter(Boolean) as { location: NonNullable<ActiveLocation>; level: keyof typeof LEVELS }[];

  return (
    <Card className={`${fillHeight ? "h-full" : "h-[240px] lg:h-full"} min-h-0 flex flex-col p-[clamp(10px,0.9vw,18px)] gap-[clamp(8px,0.7vw,14px)]`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-semibold text-sm lg:text-[clamp(18px,1.4vw,30px)] leading-none">
          <Globe2 className="h-4 w-4 lg:h-[clamp(18px,1.3vw,28px)] lg:w-[clamp(18px,1.3vw,28px)] text-primary" />
          Where is this?
        </h3>
        <span className="text-muted-foreground text-xs lg:text-[clamp(12px,0.85vw,17px)]">GeoGuessr</span>
      </div>
      <div className={`flex-1 min-h-0 grid gap-[clamp(6px,0.5vw,10px)] ${photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {photos.map((p) => (
          <GeoPhoto key={p.level} location={p.location} level={p.level} />
        ))}
      </div>
    </Card>
  );
}

export function StreetViewDisplay({ forceDesktop = false }: { forceDesktop?: boolean }) {
  const { activeLocation: easy, isLoading: easyLoading } = useActiveLocation(1);
  const { activeLocation: hard, isLoading: hardLoading } = useActiveLocation(3);
  const hasRound = !!easy?.pano_id || !!hard?.pano_id;
  const showJoinCard = !easyLoading && !hardLoading && !hasRound;

  return (
    <div
      className={`${
        forceDesktop ? "h-full min-h-0 grid grid-cols-3" : "h-full min-h-0 flex flex-col lg:grid lg:grid-cols-3"
      } gap-3 lg:gap-[clamp(12px,1vw,18px)]`}
    >
      {showJoinCard ? (
        <Card className={`${forceDesktop ? "h-full" : "h-[220px] lg:h-full"} min-h-0 flex flex-col p-0 overflow-hidden`}>
          <JoinCard />
        </Card>
      ) : (
        <GeoCard easy={easy} hard={hard} fillHeight={forceDesktop} />
      )}
      <div className={`${forceDesktop ? "h-full min-h-0 col-span-2" : "min-h-[220px] lg:h-full lg:min-h-0 lg:col-span-2"}`}>
        {/* When the big QR card isn't showing, the leaderboard carries a small one */}
        <RotatingLeaderboard wide showQr={!showJoinCard} />
      </div>
    </div>
  );
}
