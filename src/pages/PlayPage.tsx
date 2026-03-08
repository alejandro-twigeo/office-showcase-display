import { useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { PlayerAuth } from '../components/play/PlayerAuth';
import { GuessMap } from '../components/play/GuessMap';
import { PollSection } from '../components/play/PollSection';
import { YouTubeSection } from '../components/play/YouTubeSection';
import { PositiveMessagesSection } from '../components/play/PositiveMessagesSection';
import { NewsSection } from '../components/play/NewsSection';
import { Leaderboard } from '../components/dashboard/Leaderboard';
import { WordleLeaderboard } from '../components/play/WordleLeaderboard';
import { MinigameLeaderboard } from '../components/play/MinigameLeaderboard';
import { PlantStatus } from '../components/dashboard/PlantStatus';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

import { MapPin, BarChart3, Youtube, Monitor, Heart, LogOut, UserCog, Gamepad2, Newspaper, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OFFICE_FLAGS } from '@/hooks/usePlayer';
import { ProfileEditor } from '@/components/play/ProfileEditor';

type TabValue = 'guess' | 'polls' | 'youtube' | 'vibes' | 'news';

export default function PlayPage() {
  const { player, isLoading, login, signup, logout, updateProfile } = usePlayer();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('guess');
  const [showProfile, setShowProfile] = useState(false);
  const [gamesSubTab, setGamesSubTab] = useState<'easy' | 'hard' | 'other'>('easy');
  const [activeMinigame, setActiveMinigame] = useState<string | null>(null);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>;
  }

  if (!player) {
    return <PlayerAuth onLogin={login} onSignup={signup} />;
  }

  // Determine which leaderboard to show
  const renderLeaderboard = () => {
    if (gamesSubTab !== 'other') return <Leaderboard />;
    if (!activeMinigame || activeMinigame === 'wordle') return <WordleLeaderboard />;
    const GAME_LABELS: Record<string, { title: string; emoji: string }> = {
      city_guess: { title: 'City Guess', emoji: '🏙️' },
      this_or_that: { title: 'This or That', emoji: '⚖️' },
      sudoku: { title: 'Sudoku', emoji: '🔢' },
      pairs: { title: 'Pairs', emoji: '🃏' },
      labyrinth: { title: 'Labyrinth', emoji: '🌀' },
    };
    const info = GAME_LABELS[activeMinigame];
    if (!info) return <WordleLeaderboard />;
    return (
      <MinigameLeaderboard
        gameId={activeMinigame}
        title={info.title}
        emoji={info.emoji}
        formatMeta={(meta) => {
          if (meta.time_seconds != null) return `${Math.floor(meta.time_seconds / 60)}:${String(meta.time_seconds % 60).padStart(2, '0')}`;
          if (meta.moves != null) return `${meta.moves} moves`;
          if (meta.attempts != null) return `${meta.attempts} attempts`;
          return '';
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-[96vw] sm:max-w-lg lg:max-w-[90vw] xl:max-w-[92vw] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
            >
              <Monitor className="h-4 w-4" />
              <span>TV mode</span>
            </button>
            <PlantStatus playerName={player.name} />
          </div>
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
                  className="gap-2"
                  onClick={() => navigate('/manager')}
                >
                  <Shield className="h-4 w-4" />
                  Manager Mode
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
      <main className="max-w-[96vw] sm:max-w-lg lg:max-w-[90vw] xl:max-w-[92vw] mx-auto px-2 sm:px-4 py-4">
        {/* Tab buttons */}
        <div className="grid grid-cols-5 gap-1 bg-muted p-1 rounded-lg mb-4 lg:max-w-4xl">
          {([
            { value: 'guess' as const, icon: Gamepad2, label: 'Games' },
            { value: 'polls' as const, icon: BarChart3, label: 'Polls' },
            { value: 'youtube' as const, icon: Youtube, label: 'Music' },
            { value: 'news' as const, icon: Newspaper, label: 'News' },
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
          <div className="space-y-4">
            <GuessMap playerName={player.name} onActiveTabChange={(tab) => {
              setGamesSubTab(tab);
              if (tab !== 'other') setActiveMinigame(null);
            }} onMinigameChange={setActiveMinigame} />
            {renderLeaderboard()}
          </div>
        )}
        {activeTab === 'polls' && <PollSection playerName={player.name} />}
        {activeTab === 'youtube' && <YouTubeSection playerName={player.name} />}
        {activeTab === 'vibes' && <PositiveMessagesSection playerName={player.name} />}
        {activeTab === 'news' && <NewsSection />}
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
