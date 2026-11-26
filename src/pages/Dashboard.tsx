import { useState, useEffect, useCallback } from "react";
import { YouTubeDisplay } from "@/components/dashboard/YouTubeDisplay";
import { NewsDisplay } from "@/components/dashboard/NewsDisplay";
import { KudosTile } from "@/components/dashboard/PositiveMessagesBanner";
import { PlantStatus } from "@/components/dashboard/PlantStatus";
import { TvFeatureDisplay } from "@/components/dashboard/TvFeatureDisplay";
import { Clock } from "@/components/dashboard/Clock";
import { OfficeStrip } from "@/components/dashboard/OfficeStrip";
import { GamesTile } from "@/components/dashboard/GamesTile";
import { PlaySideTile } from "@/components/dashboard/StreetViewDisplay";
import { ThisWeekCard } from "@/components/dashboard/WeekTiles";
import { PlayQr } from "@/components/dashboard/JoinCard";
import { useAutoReload } from "@/hooks/useAutoReload";
import { GameSpotlightProvider } from "@/components/dashboard/GameSpotlight";
import { LiveMoments } from "@/components/dashboard/LiveMoments";
import { useDailyPoll } from "@/hooks/useDailyPoll";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Monitor } from "lucide-react";
import twigeoLogo from "@/assets/twigeo-logo.png";
import { useDeviceId } from "@/hooks/useDeviceId";
import { usePresenceTrack } from "@/hooks/usePresenceCount";
import { useTvFeatureMode, useTvFlowFullscreen } from "@/hooks/useGameIcons";

/**
 * When "Desktop mode" is active on a small screen we render the full
 * 1280×720-style layout and use CSS `zoom` so it fits the viewport.
 */
function useDesktopZoom(enabled: boolean) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!enabled) {
      setZoom(1);
      return;
    }
    const calc = () => {
      const TARGET_W = 1280;
      const TARGET_H = 720;
      const zw = window.innerWidth / TARGET_W;
      const zh = window.innerHeight / TARGET_H;
      setZoom(Math.min(zw, zh, 1)); // never zoom > 1
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [enabled]);

  return zoom;
}

export default function Dashboard() {
  return (
    <GameSpotlightProvider>
      <DashboardContent />
    </GameSpotlightProvider>
  );
}

/** Small zone heading above each column, so people learn where things live */
function ZoneLabel({ children }: { children: string }) {
  return (
    <p className="hidden lg:block px-1 font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 text-[clamp(10px,0.7vw,14px)] -mb-[clamp(4px,0.4vw,8px)]">
      {children}
    </p>
  );
}

/**
 * The three zones. Every section has a fixed home; only Now playing changes size,
 * growing while something is playing (Kudos makes room for it).
 *  - Play: games with their podiums, then riddle / GeoGuessr photos / team riddle
 *  - Together: now playing, kudos
 *  - This week: who's leading and the fika goal, the poll, the news
 */
function Zones({ desktop, tvFeatureMode }: { desktop: boolean; tvFeatureMode: "polls" | "flow" }) {
  const [playing, setPlaying] = useState(false);
  const onPlayingChange = useCallback((p: boolean) => setPlaying(p), []);
  const grow = "transition-[flex-grow] duration-700 ease-out";
  const tile = desktop ? "min-h-0" : "min-h-[280px] lg:min-h-0";

  return (
    <div className={desktop ? "h-full min-h-0 grid grid-cols-[5fr_4fr_3fr] gap-3" : "h-auto lg:h-full flex flex-col lg:grid lg:grid-cols-[5fr_4fr_3fr] gap-3 lg:gap-[clamp(12px,1vw,20px)] lg:min-h-0"}>
      {/* Play */}
      <div className="min-h-0 flex flex-col gap-3 lg:gap-[clamp(12px,1vw,20px)]">
        <ZoneLabel>Play</ZoneLabel>
        <div className={`${tile} flex-[3.2]`}>
          <GamesTile />
        </div>
        <div className={`${tile} flex-[1.4]`}>
          <PlaySideTile />
        </div>
      </div>

      {/* Together */}
      <div className="min-h-0 flex flex-col gap-3 lg:gap-[clamp(12px,1vw,20px)]">
        <ZoneLabel>Together</ZoneLabel>
        <div className={`${tile} ${grow} overflow-hidden rounded-xl`} style={{ flexGrow: playing ? 2.3 : 1, flexBasis: 0 }}>
          <YouTubeDisplay onPlayingChange={onPlayingChange} />
        </div>
        <div className={`${tile} ${grow}`} style={{ flexGrow: playing ? 1.2 : 1.7, flexBasis: 0 }}>
          <KudosTile />
        </div>
      </div>

      {/* This week */}
      <div className="min-h-0 flex flex-col gap-3 lg:gap-[clamp(12px,1vw,20px)]">
        <ZoneLabel>This week</ZoneLabel>
        <div className={`${tile} flex-[1]`}>
          <ThisWeekCard compact />
        </div>
        <div className={`${tile} flex-[1.3] overflow-hidden rounded-xl`}>
          <TvFeatureDisplay mode={tvFeatureMode} />
        </div>
        {/* Empty (no news today) collapses, so the poll and This week get the room */}
        <div className={`${tile} flex-[1.15] overflow-hidden rounded-xl empty:hidden`}>
          <NewsDisplay standalone />
        </div>
      </div>
    </div>
  );
}

function DashboardContent() {
  const navigate = useNavigate();
  const deviceId = useDeviceId();
  const [forceDesktop, setForceDesktop] = useState(false);
  const zoom = useDesktopZoom(forceDesktop);
  const { data: tvFeatureMode = "polls" } = useTvFeatureMode();
  const { data: tvFlowFullscreen = false } = useTvFlowFullscreen();
  const showFlowFullscreen = tvFeatureMode === "flow" && tvFlowFullscreen;

  useAutoReload();
  useDailyPoll();

  usePresenceTrack("app", {
    deviceId,
    page: "tv",
  });

  // Desktop-forced mode: render fixed-size layout scaled via CSS zoom
  if (forceDesktop) {
    return (
      <div
        className="tv-2027 bg-background text-foreground"
        style={{
          width: 1280,
          height: 720,
          zoom,
          transformOrigin: "top left",
          overflow: "hidden",
        }}
      >
        <div className="h-full w-full p-4">
          <div className="h-full w-full grid grid-rows-[auto_auto_1fr] gap-3">
            <header className="flex items-center gap-3">
              <h1 className="flex items-center shrink-0">
                <img src={twigeoLogo} alt="Twigeo logo" className="h-10 w-auto object-contain" />
              </h1>
              <div className="flex-1 min-w-0">
                <OfficeStrip />
              </div>
              <Clock />
              <button
                onClick={() => setForceDesktop(false)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium"
              >
                <Monitor className="h-4 w-4" />
                Mobile
              </button>
            </header>
            <LiveMoments variant="line" />
            {showFlowFullscreen ? (
              <div className="min-h-0 overflow-hidden rounded-xl">
                <TvFeatureDisplay mode="flow" fullscreen />
              </div>
            ) : (
              <Zones desktop tvFeatureMode={tvFeatureMode} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Normal responsive mode
  return (
    <div className="tv-2027 min-h-[100dvh] lg:h-[100dvh] w-full overflow-x-hidden lg:overflow-hidden bg-background text-foreground">
      <div className="h-full w-full p-2 lg:p-[clamp(16px,1.4vw,28px)]">
        <div className="h-full w-full grid grid-rows-[auto_auto_1fr] gap-3 lg:gap-[clamp(8px,0.7vw,14px)]">
          {/* Header: logo, the three offices (weather, time, race points), clock, plant, QR to play */}
          <header className="flex items-center gap-2 lg:gap-[clamp(12px,1.2vw,24px)]">
            <h1 className="flex items-center shrink-0">
              <img src={twigeoLogo} alt="Twigeo logo" className="h-8 lg:h-[clamp(36px,3.4vw,76px)] w-auto object-contain" />
            </h1>

            <div className="hidden lg:block flex-1 min-w-0">
              <OfficeStrip />
            </div>

            <div className="flex items-center gap-2 lg:gap-[clamp(10px,0.9vw,18px)] ml-auto">
              <button
                onClick={() => setForceDesktop(true)}
                className="lg:hidden shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium"
              >
                <Monitor className="h-4 w-4" />
                Desktop
              </button>

              <div className="hidden lg:block">
                <Clock />
              </div>

              <PlantStatus />

              <button
                onClick={() => navigate("/play")}
                className="lg:hidden shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
              >
                <Gamepad2 className="h-4 w-4" />
                Play
              </button>
              <button
                onClick={() => navigate("/play")}
                className="hidden lg:flex shrink-0 items-center gap-[clamp(6px,0.5vw,10px)] text-left"
                aria-label="Open the Play page"
              >
                <span className="rounded-[clamp(4px,0.3vw,6px)] bg-white p-[3px] ring-2 ring-primary">
                  <PlayQr className="h-[clamp(40px,3.2vw,68px)] w-[clamp(40px,3.2vw,68px)]" />
                </span>
                <span className="leading-tight text-muted-foreground text-[clamp(12px,0.85vw,17px)]">
                  Scan to
                  <br />
                  <span className="font-semibold text-foreground">play</span>
                </span>
              </button>
            </div>
          </header>

          {/* The latest thing that happened */}
          <div className="hidden lg:block min-w-0">
            <LiveMoments variant="line" />
          </div>

          {/* Main */}
          <div className="min-h-0 overflow-y-auto lg:overflow-hidden">
            {showFlowFullscreen ? (
              <div className="h-auto lg:h-full min-h-0 overflow-hidden rounded-xl">
                <TvFeatureDisplay mode="flow" fullscreen />
              </div>
            ) : (
              <Zones desktop={false} tvFeatureMode={tvFeatureMode} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
