import { StreetViewDisplay } from '@/components/dashboard/StreetViewDisplay';
import { PollDisplay } from '@/components/dashboard/PollDisplay';
import { YouTubeDisplay } from '@/components/dashboard/YouTubeDisplay';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
              <Label htmlFor="mode-switch">TV</Label>
            </div>
            <Switch 
              id="mode-switch" 
              checked={false}
              onCheckedChange={handleModeSwitch}
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Label htmlFor="mode-switch">Play</Label>
              <Gamepad2 className="h-4 w-4" />
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* GeoGuessr Section - Takes 2 columns */}
          <div className="lg:col-span-2 min-h-[400px]">
            <StreetViewDisplay />
          </div>

          {/* Right Column - Polls & YouTube */}
          <div className="space-y-4">
            <PollDisplay />
            <YouTubeDisplay />
          </div>
        </div>
      </div>
    </div>
  );
}
