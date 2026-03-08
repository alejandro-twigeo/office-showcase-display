import { useState, useEffect } from "react";
import { StreetViewDisplay } from "@/components/dashboard/StreetViewDisplay";
import { NewsDisplay } from "@/components/dashboard/NewsDisplay";
import { PollDisplay } from "@/components/dashboard/PollDisplay";
import { YouTubeDisplay } from "@/components/dashboard/YouTubeDisplay";
import { PositiveMessagesBanner } from "@/components/dashboard/PositiveMessagesBanner";
import { PlantStatus } from "@/components/dashboard/PlantStatus";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Monitor } from "lucide-react";
import twigeoLogo from "@/assets/twigeo-logo.png";

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
  const navigate = useNavigate();
  const [forceDesktop, setForceDesktop] = useState(false);
  const zoom = useDesktopZoom(forceDesktop);

  // Desktop-forced mode: render fixed-size layout scaled via CSS zoom
  if (forceDesktop) {
    return (
      <div
        className="bg-background"
        style={{
          width: 1280,
          height: 720,
          zoom,
          transformOrigin: "top left",
          overflow: "hidden",
        }}
      >
        <div className="h-full w-full p-4">
          <div className="h-full w-full grid grid-rows-[auto_1fr] gap-3">
            <header className="flex items-center gap-3">
              <h1 className="flex items-center shrink-0">
                <img src={twigeoLogo} alt="Twigeo logo" className="h-12 w-auto object-contain" />
              </h1>
              <div className="flex flex-1 justify-center min-w-0">
                <PositiveMessagesBanner />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setForceDesktop(false)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium"
                >
                  <Monitor className="h-4 w-4" />
                  Mobile
                </button>
                <PlantStatus />
                <button
                  onClick={() => navigate("/play")}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
                >
                  <Gamepad2 className="h-4 w-4" />
                  Play
                </button>
              </div>
            </header>

            <div className="min-h-0 grid grid-rows-[1fr_1fr] gap-3">
              <div className="min-h-0 grid grid-cols-3 gap-3">
                <div className="min-h-0 overflow-hidden rounded-xl"><YouTubeDisplay /></div>
                <div className="min-h-0 overflow-hidden rounded-xl"><NewsDisplay /></div>
                <div className="min-h-0 overflow-hidden rounded-xl"><PollDisplay /></div>
              </div>
              <div className="min-h-0 overflow-hidden rounded-xl">
                <StreetViewDisplay forceDesktop />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal responsive mode
  return (
    <div className="min-h-[100dvh] lg:h-[100dvh] w-full overflow-x-hidden lg:overflow-hidden bg-background">
      <div className="h-full w-full p-2 lg:p-[clamp(16px,1.6vw,28px)]">
        <div className="h-full w-full grid grid-rows-[auto_1fr] gap-3 lg:gap-[clamp(12px,1.2vw,20px)]">
          {/* Header */}
          <header className="flex items-center gap-2 lg:gap-[clamp(12px,1.2vw,24px)]">
            <h1 className="flex items-center shrink-0">
              <img
                src={twigeoLogo}
                alt="Twigeo logo"
                className="h-8 lg:h-[clamp(40px,4vw,90px)] w-auto object-contain"
              />
            </h1>

            <div className="hidden lg:flex flex-1 justify-center min-w-0">
              <PositiveMessagesBanner />
            </div>

            <div className="flex items-center gap-2 lg:gap-[clamp(8px,0.7vw,14px)] ml-auto">
              <button
                onClick={() => setForceDesktop(true)}
                className="lg:hidden shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-border text-muted-foreground hover:bg-muted transition-colors text-sm font-medium"
              >
                <Monitor className="h-4 w-4" />
                Desktop
              </button>

              <PlantStatus />

              <button
                onClick={() => navigate("/play")}
                className="shrink-0 flex items-center gap-1.5 lg:gap-[clamp(8px,0.7vw,14px)] px-3 py-1.5 lg:px-[clamp(14px,1.2vw,24px)] lg:py-[clamp(8px,0.6vw,14px)] rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-sm lg:text-[clamp(15px,1.2vw,22px)] font-medium"
              >
                <Gamepad2 className="h-4 w-4 lg:h-[clamp(18px,1.3vw,26px)] lg:w-[clamp(18px,1.3vw,26px)]" />
                Play
              </button>
            </div>
          </header>

          {/* Main grid */}
          <div className="min-h-0 overflow-y-auto lg:overflow-hidden">
            <div className="h-auto lg:h-full flex flex-col lg:grid lg:grid-rows-[1fr_1fr] gap-3 lg:gap-[clamp(12px,1.2vw,20px)] lg:min-h-0">
              <div className="min-h-0 flex flex-col lg:grid lg:grid-cols-3 gap-3 lg:gap-[clamp(12px,1.2vw,20px)]">
                <div className="min-h-0 lg:h-full overflow-hidden rounded-xl"><YouTubeDisplay /></div>
                <div className="min-h-0 overflow-hidden rounded-xl"><NewsDisplay /></div>
                <div className="min-h-0 overflow-hidden rounded-xl"><PollDisplay /></div>
              </div>
              <div className="min-h-0 overflow-hidden rounded-xl">
                <StreetViewDisplay />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
