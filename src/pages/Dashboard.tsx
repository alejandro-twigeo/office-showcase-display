import { useState } from "react";
import { StreetViewDisplay } from "@/components/dashboard/StreetViewDisplay";
import { NewsDisplay } from "@/components/dashboard/NewsDisplay";
import { PollDisplay } from "@/components/dashboard/PollDisplay";
import { YouTubeDisplay } from "@/components/dashboard/YouTubeDisplay";
import { PositiveMessagesBanner } from "@/components/dashboard/PositiveMessagesBanner";
import { PlantStatus } from "@/components/dashboard/PlantStatus";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Monitor } from "lucide-react";
import twigeoLogo from "@/assets/twigeo-logo.png";

export default function Dashboard() {
  const navigate = useNavigate();
  const [forceDesktop, setForceDesktop] = useState(false);

  // When forceDesktop is on, we set a fixed width to simulate desktop layout
  const desktopClass = forceDesktop ? "force-desktop" : "";

  return (
    <div className={`min-h-[100dvh] w-full overflow-x-hidden bg-background ${forceDesktop ? 'md-force' : ''}`}
      style={forceDesktop ? { minWidth: '1280px', overflow: 'auto' } : undefined}
    >
      <div className="h-full w-full p-2 md:p-[clamp(16px,1.6vw,28px)]"
        style={forceDesktop ? { height: '100dvh', overflow: 'hidden' } : undefined}
      >
        <div className="h-full w-full grid grid-rows-[auto_1fr] gap-[clamp(12px,1.2vw,20px)]">

          {/* Header */}
          <header className="flex items-center gap-2 md:gap-[clamp(12px,1.2vw,24px)]">
            {/* Logo */}
            <h1 className="flex items-center shrink-0">
              <img
                src={twigeoLogo}
                alt="Twigeo logo"
                className="h-8 md:h-[clamp(40px,4vw,90px)] w-auto object-contain"
              />
            </h1>

            {/* centered rotating message — hidden on small mobile, visible on force-desktop */}
            <div className={`${forceDesktop ? 'flex' : 'hidden md:flex'} flex-1 justify-center min-w-0`}>
              <PositiveMessagesBanner />
            </div>

            {/* plant + play + desktop toggle */}
            <div className="flex items-center gap-2 md:gap-[clamp(8px,0.7vw,14px)] ml-auto">
              {/* Desktop mode button — only visible on real mobile (not when forced) */}
              {!forceDesktop && (
                <button
                  onClick={() => setForceDesktop(true)}
                  className="md:hidden shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-muted-foreground/40 text-muted-foreground hover:bg-muted transition-colors text-sm font-medium"
                  aria-label="Switch to desktop mode for casting"
                >
                  <Monitor className="h-4 w-4" />
                  <span className="hidden xs:inline">Cast</span>
                </button>
              )}
              {forceDesktop && (
                <button
                  onClick={() => setForceDesktop(false)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-muted-foreground/40 text-muted-foreground hover:bg-muted transition-colors text-sm font-medium"
                  aria-label="Switch back to mobile mode"
                >
                  <Monitor className="h-4 w-4" />
                  Mobile
                </button>
              )}
              <PlantStatus />
              <button
                onClick={() => navigate("/play")}
                className="shrink-0 flex items-center gap-1.5 md:gap-[clamp(8px,0.7vw,14px)] px-3 py-1.5 md:px-[clamp(14px,1.2vw,24px)] md:py-[clamp(8px,0.6vw,14px)] rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-sm md:text-[clamp(15px,1.2vw,22px)] font-medium"
                aria-label="Go to Play page"
              >
                <Gamepad2 className="h-4 w-4 md:h-[clamp(18px,1.3vw,26px)] md:w-[clamp(18px,1.3vw,26px)]" />
                Play
              </button>
            </div>
          </header>

          {/* Main grid */}
          <div className={`min-h-0 ${forceDesktop ? 'overflow-hidden' : 'overflow-y-auto md:overflow-hidden'}`}>
            <div className={`${forceDesktop ? 'h-full grid grid-rows-[1fr_1fr]' : 'h-auto md:h-full flex flex-col md:grid md:grid-rows-[1fr_1fr]'} gap-[clamp(12px,1.2vw,20px)] md:min-h-0`}>
              
              {/* Top row */}
              <div className={`min-h-0 ${forceDesktop ? 'grid grid-cols-3' : 'flex flex-col md:grid md:grid-cols-3'} gap-[clamp(12px,1.2vw,20px)]`}>
                <div className={`${forceDesktop ? '' : 'min-h-[200px] md:min-h-0'} md:h-full overflow-hidden rounded-xl`}>
                  <YouTubeDisplay />
                </div>
                <div className={`${forceDesktop ? '' : 'min-h-[200px] md:min-h-0'} overflow-hidden rounded-xl`}>
                  <NewsDisplay />
                </div>
                <div className={`${forceDesktop ? '' : 'min-h-[200px] md:min-h-0'} overflow-hidden rounded-xl`}>
                  <PollDisplay />
                </div>
              </div>

              {/* Bottom row */}
              <div className={`${forceDesktop ? '' : 'min-h-[200px] md:min-h-0'} overflow-hidden rounded-xl`}>
                <StreetViewDisplay />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
