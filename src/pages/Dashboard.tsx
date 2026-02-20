import { StreetViewDisplay } from "@/components/dashboard/StreetViewDisplay";
import { PollDisplay } from "@/components/dashboard/PollDisplay";
import { YouTubeDisplay } from "@/components/dashboard/YouTubeDisplay";
import { useNavigate } from "react-router-dom";
import { Monitor, Gamepad2 } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-background">
      <div className="h-full w-full p-[clamp(16px,1.6vw,28px)]">
        <div className="h-full w-full grid grid-rows-[auto_1fr] gap-[clamp(12px,1.2vw,20px)]">
          <header className="flex items-center justify-between">
<h1 className="flex items-center">
  <img
    src="https://usercontent.one/wp/www.twigeo.com/wp-content/uploads/2023/09/favicon2-150x150.png?media=1770653196"
    alt="Twigeo logo"
    className="h-[clamp(40px,4vw,90px)] w-auto object-contain"
  />
</h1>

            <div className="flex items-center gap-[clamp(10px,1vw,16px)]">
              <div className="flex items-center gap-2 text-muted-foreground text-[clamp(15px,1.2vw,22px)]">
                <Monitor className="h-[clamp(18px,1.3vw,24px)] w-[clamp(18px,1.3vw,24px)]" />
                <span>TV</span>
              </div>

              <button
                onClick={() => navigate("/play")}
                className="relative inline-flex items-center rounded-full bg-muted transition-colors
                           h-[clamp(30px,2vw,42px)] w-[clamp(56px,3.8vw,76px)]"
                aria-label="Switch to play mode"
              >
                <span
                  className="inline-block rounded-full bg-foreground transition-transform
                             h-[clamp(22px,1.5vw,32px)] w-[clamp(22px,1.5vw,32px)] translate-x-1"
                />
              </button>

              <div className="flex items-center gap-2 text-muted-foreground text-[clamp(15px,1.2vw,22px)]">
                <span>Play</span>
                <Gamepad2 className="h-[clamp(18px,1.3vw,24px)] w-[clamp(18px,1.3vw,24px)]" />
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            <div className="h-full grid grid-rows-[55fr_45fr] gap-[clamp(12px,1.2vw,20px)] min-h-0">
              <div className="min-h-0 grid grid-cols-[2fr_1fr] gap-[clamp(12px,1.2vw,20px)]">
                <div className="min-h-0 h-full overflow-hidden rounded-xl">
                  <YouTubeDisplay />
                </div>
                <div className="min-h-0 overflow-hidden rounded-xl">
                  <PollDisplay />
                </div>
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
