import { useState, useEffect, useCallback } from "react";
import { YouTubeDisplay } from "@/components/dashboard/YouTubeDisplay";
import { KudosTile } from "@/components/dashboard/PositiveMessagesBanner";
import { TvFeatureDisplay } from "@/components/dashboard/TvFeatureDisplay";
import { Clock } from "@/components/dashboard/Clock";
import { OfficeStrip } from "@/components/dashboard/OfficeStrip";
import { GamesTile } from "@/components/dashboard/GamesTile";
import { PlaySideTile } from "@/components/dashboard/StreetViewDisplay";
import { ThisWeekCard } from "@/components/dashboard/WeekTiles";
import { PlayQr } from "@/components/dashboard/JoinCard";
import { useAutoReload } from "@/hooks/useAutoReload";
import { GameSpotlightProvider, useSpotlight } from "@/components/dashboard/GameSpotlight";
import { LiveMoments } from "@/components/dashboard/LiveMoments";
import { ChatTile } from "@/components/dashboard/ChatTile";
import { useChat } from "@/hooks/useChat";
import { useDailyPoll } from "@/hooks/useDailyPoll";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Monitor } from "lucide-react";
import twigeoLogo from "@/assets/twigeo-logo.png";
import { useDeviceId } from "@/hooks/useDeviceId";
import { usePresenceTrack } from "@/hooks/usePresenceCount";
import { useTvFeatureMode, useTvFlowFullscreen } from "@/hooks/useGameIcons";
import { HandArrow } from "@/components/Squiggles";

/** Moving background + frosted tiles. ?noglass in the address turns them off. */
const GLASS = typeof window === "undefined" || !new URLSearchParams(window.location.search).has("noglass");

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

/** The poll slot. Today's news no longer takes turns here: it's a topic in the chat now. */
function PollNewsSlot({ tvFeatureMode }: { tvFeatureMode: "polls" | "flow" }) {
  return (
    <div className="relative h-full">
      <TvFeatureDisplay mode={tvFeatureMode} />
    </div>
  );
}

/**
 * The three zones. Every section has a fixed home. Tiles are as tall as their content,
 * and one tile per column takes whatever room is left, so there's no empty space:
 *  - Play: games with their podiums (fills), then both riddles / GeoGuessr photos
 *  - Together (a little wider than the others): now playing (compact, or a 16:9 video with the queue under it), then kudos (fills)
 *  - This week: who's leading (with 2nd and 3rd) and the fika goal, the poll (news is a chat topic now),
 *    and the office chat filling the rest. Every tile keeps its place, chat or no chat.
 */
function Zones({ desktop, tvFeatureMode }: { desktop: boolean; tvFeatureMode: "polls" | "flow" }) {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const onPlayingChange = useCallback((p: boolean) => setVideoPlaying(p), []);
  // Game how-to demos also play inside Now playing, so it grows for them too
  const spotlight = useSpotlight();
  // A video sizes its own tile (16:9 plus the queue row); a how-to demo with no video still needs room
  const demoOnly = spotlight?.phase === "demo" && !videoPlaying;
  const grow = "transition-[flex-grow] duration-700 ease-out";
  const tile = desktop ? "min-h-0" : "min-h-[280px] lg:min-h-0";
  // sized to its content: never stretched, never squeezed
  const fit = "shrink-0";
  // The chat always has its home at the bottom of This week (quiet or not), so nothing moves around
  const { messages: chat, now, post: postChat } = useChat();

  // Columns are fixed shares (minmax(0, …)), so nothing inside can push one wider than its share
  return (
    <div className={desktop ? "h-full min-h-0 grid grid-cols-[minmax(0,3.9fr)_minmax(0,4.7fr)_minmax(0,3.4fr)] gap-3" : "h-auto lg:h-full flex flex-col lg:grid lg:grid-cols-[minmax(0,3.9fr)_minmax(0,4.7fr)_minmax(0,3.4fr)] gap-3 lg:gap-[clamp(12px,1vw,20px)] lg:min-h-0"}>
      {/* Play */}
      <div className="min-h-0 flex flex-col gap-3 lg:gap-[clamp(12px,1vw,20px)]">
        <div className={`${tile} flex-[3.2]`}>
          <GamesTile />
        </div>
        <div className={`${tile} flex-[1.4]`}>
          <PlaySideTile />
        </div>
      </div>

      {/* Together */}
      <div className="min-h-0 flex flex-col gap-3 lg:gap-[clamp(12px,1vw,20px)]">
        {/* As tall as its content: compact when nothing plays, a 16:9 video plus the queue row when one does.
            Kudos takes the rest of the column */}
        <div
          className={`${demoOnly ? tile : fit} ${grow} overflow-hidden rounded-xl`}
          style={demoOnly ? { flexGrow: 3, flexBasis: 0 } : undefined}
        >
          <YouTubeDisplay onPlayingChange={onPlayingChange} />
        </div>
        <div className={`${tile} ${grow}`} style={{ flexGrow: 1, flexBasis: 0 }}>
          <KudosTile />
        </div>
      </div>

      {/* This week */}
      <div className="min-h-0 flex flex-col gap-3 lg:gap-[clamp(12px,1vw,20px)]">
        {/* Leader, 2nd and 3rd, and the goal */}
        <div className={fit}>
          <ThisWeekCard compact />
        </div>
        {tvFeatureMode === "flow" ? (
          // Flow (a chart) needs room, so it shares the column
          <div className={`${tile} flex-1 overflow-hidden rounded-xl`}>
            <TvFeatureDisplay mode={tvFeatureMode} />
          </div>
        ) : (
          // The poll, at a fixed height
          <div className={`${desktop ? "h-[260px]" : "min-h-[280px] lg:min-h-0 lg:h-[clamp(250px,18.5vw,400px)]"} shrink-0 overflow-hidden rounded-xl`}>
            <PollNewsSlot tvFeatureMode={tvFeatureMode} />
          </div>
        )}
        {/* Office chat: always here, takes the rest of the column */}
        <div className={`${tile} flex-1`}>
          <ChatTile messages={chat} now={now} onSend={(body, me) => postChat.mutate({ body, created_by: me })} />
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
              <button
                onClick={() => navigate("/play")}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
              >
                <Gamepad2 className="h-4 w-4" />
                Play
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
    <div className={`tv-2027 ${GLASS ? "tv-glass" : ""} relative min-h-[100dvh] lg:h-[100dvh] w-full overflow-x-hidden lg:overflow-hidden bg-background text-foreground`}>
      {GLASS && (
        <div className="tv-backdrop" aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
      <div className="relative z-[1] h-full w-full p-2 lg:p-[clamp(16px,1.4vw,28px)]">
        <div className="h-full w-full grid grid-rows-[auto_auto_1fr] gap-3 lg:gap-[clamp(8px,0.7vw,14px)]">
          {/* Header: logo, the three offices (weather, time, race points), clock, QR to play */}
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

              {/* Play: for laptops (phones scan the QR) */}
              <button
                onClick={() => navigate("/play")}
                className="shrink-0 flex items-center gap-1.5 lg:gap-[clamp(6px,0.5vw,10px)] px-3 py-1.5 lg:px-[clamp(14px,1.1vw,22px)] lg:py-[clamp(7px,0.55vw,12px)] rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-sm lg:text-[clamp(14px,1.05vw,21px)] font-medium"
              >
                <Gamepad2 className="h-4 w-4 lg:h-[clamp(16px,1.2vw,24px)] lg:w-[clamp(16px,1.2vw,24px)]" />
                Play
              </button>
              <button
                onClick={() => navigate("/play")}
                className="hidden lg:flex shrink-0 items-center gap-[clamp(6px,0.5vw,10px)] text-left"
                aria-label="Open the Play page"
              >
                {/* A hand-drawn arrow, so new people see where to start */}
                <HandArrow className="h-[clamp(16px,1.3vw,28px)] w-auto -mr-[clamp(2px,0.25vw,5px)]" />
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
