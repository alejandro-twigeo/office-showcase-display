import { StreetViewDisplay } from '@/components/dashboard/StreetViewDisplay';
import { PollDisplay } from '@/components/dashboard/PollDisplay';
import { YouTubeDisplay } from '@/components/dashboard/YouTubeDisplay';
import { useNavigate } from 'react-router-dom';
import { Monitor, Gamepad2 } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleModeSwitch = (checked: boolean) => {
    if (checked) {
      navigate('/play');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1920px] mx-auto space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between py-2">
          <h1 className="text-2xl font-bold text-foreground">
            🎮 Office TV Dashboard
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Monitor className="h-4 w-4" />
              <span>TV</span>
            </div>
            <button
              onClick={() => navigate('/play')}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted transition-colors"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-foreground transition-transform translate-x-1" />
            </button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Play</span>
              <Gamepad2 className="h-4 w-4" />
            </div>
          </div>
        </header>

        {/* Top Row: YouTube 2/3 + Polls 1/3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <YouTubeDisplay />
          </div>
          <div>
            <PollDisplay />
          </div>
        </div>

        {/* Bottom Row: Mystery Location 1/2 + Leaderboard 1/2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[400px]">
          <StreetViewDisplay />
        </div>
      </div>
    </div>
  );
}
