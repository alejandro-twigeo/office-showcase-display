import { useState } from 'react';
import { MapPin, BarChart3, Youtube, Heart, Newspaper, Gamepad2, LogOut, UserCog, Shield, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GuessMap } from './GuessMap';
import { PollSection } from './PollSection';
import { YouTubeSection } from './YouTubeSection';
import { PositiveMessagesSection } from './PositiveMessagesSection';
import { NewsSection } from './NewsSection';
import { Leaderboard } from '@/components/dashboard/Leaderboard';
import { WordleLeaderboard } from './WordleLeaderboard';
import { MinigameLeaderboard } from './MinigameLeaderboard';
import { PlantStatus } from '@/components/dashboard/PlantStatus';
import { ProfileEditor } from './ProfileEditor';
import { OFFICE_FLAGS } from '@/hooks/usePlayer';

type TabValue = 'guess' | 'polls' | 'youtube' | 'vibes' | 'news';

interface MobilePlayLayoutProps {
  player: { name: string; avatar: string; office: string };
  logout: () => void;
  updateProfile: (data: any) => void;
}

export function MobilePlayLayout({ player, logout, updateProfile }: MobilePlayLayoutProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('guess');
  const [showProfile, setShowProfile] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [gamesSubTab, setGamesSubTab] = useState<'easy' | 'hard' | 'other'>('easy');
  const [activeMinigame, setActiveMinigame] = useState<string | null>(null);

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

  const tabs: { value: TabValue; icon: typeof Gamepad2; label: string }[] = [
    { value: 'guess', icon: Gamepad2, label: 'Games' },
    { value: 'polls', icon: BarChart3, label: 'Polls' },
    { value: 'youtube', icon: Youtube, label: 'Music' },
    { value: 'news', icon: Newspaper, label: 'News' },
    { value: 'vibes', icon: Heart, label: 'Vibes' },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Compact mobile header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-3 py-2 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlantStatus playerName={player.name} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 px-2 py-1.5 rounded-full border border-primary/50 text-primary text-xs font-medium active:bg-primary/10 transition-colors"
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>TV</span>
            </button>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1 p-1.5 rounded-full active:bg-secondary/60 transition-colors"
            >
              <span className="text-lg">{player.avatar}</span>
              <span className="text-xs font-medium max-w-[80px] truncate">{player.name}</span>
              <span className="text-xs">{OFFICE_FLAGS[player.office]}</span>
            </button>
          </div>
        </div>

        {/* Dropdown menu - mobile friendly */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-3 top-full mt-1 z-50 bg-card border rounded-xl shadow-lg overflow-hidden min-w-[180px]">
              <button
                className="flex items-center gap-3 w-full px-4 py-3 text-sm active:bg-secondary/60 transition-colors"
                onClick={() => { setShowProfile(true); setShowMenu(false); }}
              >
                <UserCog className="h-4 w-4" />
                Edit Profile
              </button>
              <button
                className="flex items-center gap-3 w-full px-4 py-3 text-sm active:bg-secondary/60 transition-colors"
                onClick={() => { navigate('/manager'); setShowMenu(false); }}
              >
                <Shield className="h-4 w-4" />
                Manager Mode
              </button>
              <div className="border-t" />
              <button
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-destructive active:bg-destructive/10 transition-colors"
                onClick={() => { logout(); setShowMenu(false); }}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </>
        )}
      </header>

      {/* Scrollable content area - takes remaining space above bottom nav */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 pb-20 space-y-3">
        {activeTab === 'guess' && (
          <div className="space-y-3">
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

      {/* Bottom tab bar - native app style */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t safe-area-bottom">
        <div className="grid grid-cols-5 h-14">
          {tabs.map(({ value, icon: Icon, label }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 ${value === 'vibes' && isActive ? 'fill-primary' : ''}`} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Profile editor */}
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
