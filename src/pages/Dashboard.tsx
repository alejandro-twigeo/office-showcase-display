import { StreetViewDisplay } from '@/components/dashboard/StreetViewDisplay';
import { PollDisplay } from '@/components/dashboard/PollDisplay';
import { YouTubeDisplay } from '@/components/dashboard/YouTubeDisplay';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1920px] mx-auto space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between py-2">
          <h1 className="text-2xl font-bold text-foreground">
            🎮 Office TV Dashboard
          </h1>
          <div className="text-sm text-muted-foreground">
            Visit <span className="font-mono bg-secondary px-2 py-1 rounded">/play</span> to join!
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
