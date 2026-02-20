import { useState } from 'react';
import { usePlayerName } from '../hooks/usePlayerName';
import { NameEntry } from '../components/play/NameEntry';
import { GuessMap } from '../components/play/GuessMap';
import { PollSection } from '../components/play/PollSection';
import { YouTubeSection } from '../components/play/YouTubeSection';
import { PositiveMessagesSection } from '../components/play/PositiveMessagesSection';
import { Button } from '../components/ui/button';

import { User, MapPin, BarChart3, Youtube, Monitor, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type TabValue = 'guess' | 'polls' | 'youtube' | 'vibes';

export default function PlayPage() {
  const [playerName, setPlayerName] = usePlayerName();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('guess');

  if (!playerName) {
    return <NameEntry onSubmit={setPlayerName} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Monitor className="h-4 w-4" />
            <span>TV mode</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{playerName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem('office-tv-player-name');
                window.location.reload();
              }}
            >
              Change
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto p-4">
        {/* Tab buttons */}
        <div className="grid grid-cols-4 gap-1 bg-muted p-1 rounded-lg mb-4">
          {([
            { value: 'guess' as const, icon: MapPin, label: 'Guess' },
            { value: 'polls' as const, icon: BarChart3, label: 'Polls' },
            { value: 'youtube' as const, icon: Youtube, label: 'Music' },
            { value: 'vibes' as const, icon: Heart, label: 'Vibes' },
          ]).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium transition-all ${
                activeTab === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`h-4 w-4 ${value === 'vibes' && activeTab === 'vibes' ? 'fill-primary text-primary' : ''}`} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'guess' && <GuessMap playerName={playerName} />}
        {activeTab === 'polls' && <PollSection playerName={playerName} />}
        {activeTab === 'youtube' && <YouTubeSection playerName={playerName} />}
        {activeTab === 'vibes' && <PositiveMessagesSection playerName={playerName} />}
      </main>
    </div>
  );
}
