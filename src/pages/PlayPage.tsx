import { useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { PlayerAuth } from '../components/play/PlayerAuth';
import { GuessMap } from '../components/play/GuessMap';
import { PollSection } from '../components/play/PollSection';
import { YouTubeSection } from '../components/play/YouTubeSection';
import { PositiveMessagesSection } from '../components/play/PositiveMessagesSection';
import { Leaderboard } from '../components/dashboard/Leaderboard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

import { MapPin, BarChart3, Youtube, Monitor, Heart, LogOut, UserCog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OFFICE_FLAGS } from '@/hooks/usePlayer';
import { ProfileEditor } from '@/components/play/ProfileEditor';
import { useActiveLocation } from '@/hooks/useActiveLocation';
import { useGuesses } from '@/hooks/useGuesses';

type TabValue = 'guess' | 'polls' | 'youtube' | 'vibes';

export default function PlayPage() {
  const { player, isLoading, login, signup, logout, updateProfile } = usePlayer();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('guess');
  const [showProfile, setShowProfile] = useState(false);

  const { activeLocation: easyLocation } = useActiveLocation(1);
  const { activeLocation: hardLocation } = useActiveLocation(3);
  const { guesses: easyGuesses } = useGuesses(easyLocation?.id);
  const { guesses: hardGuesses } = useGuesses(hardLocation?.id);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>;
  }

  if (!player) {
    return <PlayerAuth onLogin={login} onSignup={signup} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
          >
            <Monitor className="h-4 w-4" />
            <span>TV mode</span>
          </button>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 p-1 rounded-full hover:bg-secondary/60 transition-colors">
                  <span className="text-lg">{player.avatar}</span>
                  <span className="text-sm">{player.name}</span>
                  <span className="text-xs">{OFFICE_FLAGS[player.office]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => setShowProfile(true)}
                >
                  <UserCog className="h-4 w-4" />
                  Edit Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive gap-2"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`h-4 w-4 ${value === 'vibes' && activeTab === 'vibes' ? 'fill-primary text-primary' : ''}`} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'guess' && (
          <>
            <GuessMap playerName={player.name} />
            <div className="mt-4">
              <Leaderboard easyGuesses={easyGuesses} hardGuesses={hardGuesses} />
            </div>
          </>
        )}
        {activeTab === 'polls' && <PollSection playerName={player.name} />}
        {activeTab === 'youtube' && <YouTubeSection playerName={player.name} />}
        {activeTab === 'vibes' && <PositiveMessagesSection playerName={player.name} />}
      </main>

      {/* Profile editor dialog */}
      {showProfile && (
        <ProfileEditor
          player={player}
          onUpdate={updateProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
