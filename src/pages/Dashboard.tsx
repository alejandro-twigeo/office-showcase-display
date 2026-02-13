import { StreetViewDisplay } from "@/components/dashboard/StreetViewDisplay";
import { PollDisplay } from "@/components/dashboard/PollDisplay";
import { YouTubeDisplay } from "@/components/dashboard/YouTubeDisplay";
import { useNavigate } from "react-router-dom";
import { Monitor, Gamepad2 } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-background">
      {/* Use responsive padding that still feels big on TVs */}
      <div className="h-full w-full p-[clamp(12px,1.4vw,24px)]">
        {/* Full-height layout: header + content fills the rest */}
        <div className="h-full w-full grid grid-rows-[auto_1fr] gap-[clamp(10px,1.2vw,18px)]">
          {/* Header */}
          <header className="flex items-center justify-between">
            <h1 className="font-bold text-foreground text-[clamp(22px,2.2vw,44px)] leading-none">
              🎮 Office TV Dashboard
            </h1>

            <div className="flex items-center gap-[clamp(10px,1vw,16px)]">
              <div className="flex items-center gap-2 text-muted-foreground text-[clamp(14px,1.1vw,20px)]">
                <Monitor className="h-[clamp(16px,1.2vw,22px)] w-[clamp(16px,1.2vw,22px)]" />
                <span>TV</span>
              </div>

              <button
                onClick={() => navigate("/play")}
                className="relative inline-flex items-center rounded-full bg-muted transition-colors
                           h-[clamp(28px,2.0vw,40px)] w-[clamp(52px,3.6vw,72px)]"
                aria-label="Switch to play mode"
              >
                <span
                  className="inline-block rounded-full bg-foreground transition-transform
                             h-[clamp(20px,1.4vw,30px)] w-[clamp(20px,1.4vw,30px)] translate-x-1"
                />
              </button>

              <div className="flex items-center gap-2 text-muted-foreground text-[clamp(14px,1.1vw,20px)]">
                <span>Play</span>
                <Gamepad2 className="h-[clamp(16px,1.2vw,22px)] w-[clamp(16px,1.2vw,22px)]" />
              </div>
            </div>
          </header>

          {/* Content area must be allowed to shrink */}
          <div className="min-h-0">
            {/* Split remaining height into two rows: top (YouTube+Poll) + bottom (StreetView) */}
            <div className="h-full grid grid-rows-[60%_40%] gap-[clamp(10px,1.2vw,18px)] min-h-0">
              {/* Top row */}
              <div className="min-h-0 grid grid-cols-3 gap-[clamp(10px,1.2vw,18px)]">
                <div className="col-span-2 min-h-0 overflow-hidden rounded-xl">
                  <YouTubeDisplay />
                </div>
                <div className="col-span-1 min-h-0 overflow-hidden rounded-xl">
                  <PollDisplay />
                </div>
              </div>

              {/* Bottom row */}
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
