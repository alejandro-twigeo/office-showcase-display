import { StreetViewDisplay } from "@/components/dashboard/StreetViewDisplay";
import { PollDisplay } from "@/components/dashboard/PollDisplay";
import { YouTubeDisplay } from "@/components/dashboard/YouTubeDisplay";
import { PositiveMessagesBanner } from "@/components/dashboard/PositiveMessagesBanner";
import { PlantStatus } from "@/components/dashboard/PlantStatus";
import { useNavigate } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import twigeoLogo from "@/assets/twigeo-logo.png";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-background">
      <div className="h-full w-full p-[clamp(16px,1.6vw,28px)]">
        <div className="h-full w-full grid grid-rows-[auto_1fr] gap-[clamp(12px,1.2vw,20px)]">

          {/* Header */}
          <header className="flex items-center gap-[clamp(12px,1.2vw,24px)]">
            {/* Logo */}
            <h1 className="flex items-center shrink-0">
              <img
                src={twigeoLogo}
                alt="Twigeo logo"
                className="h-[clamp(40px,4vw,90px)] w-auto object-contain"
              />
            </h1>

            {/* centered rotating message */}
            <div className="flex-1 flex justify-center min-w-0">
              <PositiveMessagesBanner />
            </div>

            {/* plant + play */}
            <div className="flex items-center gap-[clamp(8px,0.7vw,14px)]">
              <PlantStatus />
              <button
                onClick={() => navigate("/play")}
                className="shrink-0 flex items-center gap-[clamp(8px,0.7vw,14px)] px-[clamp(14px,1.2vw,24px)] py-[clamp(8px,0.6vw,14px)] rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-[clamp(15px,1.2vw,22px)] font-medium"
                aria-label="Go to Play page"
              >
                <Gamepad2 className="h-[clamp(18px,1.3vw,26px)] w-[clamp(18px,1.3vw,26px)]" />
                Play
              </button>
            </div>
          </header>

          {/* Main grid */}
          <div className="min-h-0">
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
