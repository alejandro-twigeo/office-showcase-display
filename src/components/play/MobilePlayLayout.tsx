import { useState, useRef } from 'react';
import { BarChart3, Youtube, Heart, Newspaper, Gamepad2, LogOut, UserCog, Shield, Monitor, Target, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Player } from '@/hooks/usePlayer';
import { GuessMap } from './GuessMap';
import { PollSection } from './PollSection';
import { YouTubeSection } from './YouTubeSection';
import { PositiveMessagesSection } from './PositiveMessagesSection';
import { NewsSection } from './NewsSection';
import { PlantStatus } from '@/components/dashboard/PlantStatus';
import { ProfileEditor } from './ProfileEditor';
import { OFFICE_FLAGS } from '@/hooks/usePlayer';
import { WordleGame } from './WordleGame';
import { CityGuessGame } from './games/CityGuessGame';
import { ThisOrThatGame } from './games/ThisOrThatGame';
import { SudokuGame } from './games/SudokuGame';
import { PairsGame } from './games/PairsGame';
import { LabyrinthGame } from './games/LabyrinthGame';
import { MiniGamesLeaderboardGrid } from './MiniGamesLeaderboardGrid';
import { MINI_GAMES } from './miniGamesList';
import { useGameIcons } from '@/hooks/useGameIcons';
import { useRounds } from '@/hooks/useRounds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TabValue = 'games' | 'polls' | 'youtube' | 'vibes' | 'news' | 'leaderboards';

interface MobilePlayLayoutProps {
  player: Player;
  logout: () => void;
  updateProfile: (updates: { name?: string; office?: string; avatar?: string }) => Promise<{ ok: boolean; error?: string }>;
}

export function MobilePlayLayout({ player, logout, updateProfile }: MobilePlayLayoutProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('games');
  const [showProfile, setShowProfile] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const { icons } = useGameIcons();
  const { activeRound } = useRounds();

  const tabs: { value: TabValue; icon: typeof Gamepad2; label: string }[] = [
    { value: 'games', icon: Gamepad2, label: 'Games' },
    { value: 'leaderboards', icon: Trophy, label: 'Ranks' },
    { value: 'polls', icon: BarChart3, label: 'Polls' },
    { value: 'youtube', icon: Youtube, label: 'Music' },
    { value: 'news', icon: Newspaper, label: 'News' },
    { value: 'vibes', icon: Heart, label: 'Vibes' },
  ];

  const renderGameContent = () => {
    if (!selectedGame) {
      return (
        <div className="space-y-4">
          <div className="px-1">
            <h2 className="text-xl font-bold">Games</h2>
            <p className="text-sm text-muted-foreground">Pick a game to play</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {/* GeoGuessr */}
            <button
              onClick={() => setSelectedGame('geoguessr')}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-primary/10 active:scale-95 transition-transform text-center overflow-hidden"
            >
              <div className="w-full aspect-square rounded-2xl overflow-hidden">
                {icons['geoguessr'] ? (
                  <img src={icons['geoguessr']} alt="GeoGuessr" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <Target className="h-10 w-10 text-primary" />
                  </div>
                )}
              </div>
              <p className="font-semibold text-xs pb-2">GeoGuessr</p>
            </button>

            {/* Mini games */}
            {MINI_GAMES.map((game) => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game.id)}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-secondary/30 active:scale-95 transition-transform text-center overflow-hidden"
              >
                <div className="w-full aspect-square rounded-2xl overflow-hidden">
                  {icons[game.id] ? (
                    <img src={icons[game.id]} alt={game.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                      <span className="text-4xl">{game.emoji}</span>
                    </div>
                  )}
                </div>
                <p className="font-semibold text-xs pb-2">{game.name}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Render selected game directly (no back button — use bottom nav "Games" to go back)
    return (
      <div className="space-y-2">
        {selectedGame === 'geoguessr' && (
          <GuessMap playerName={player.name} hideOtherGames />
        )}
        {selectedGame === 'wordle' && <WordleGame playerName={player.name} />}
        {selectedGame === 'city_guess' && <CityGuessGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'this_or_that' && <ThisOrThatGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'sudoku' && <SudokuGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'pairs' && <PairsGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'labyrinth' && <LabyrinthGame playerName={player.name} roundId={activeRound?.id} />}
      </div>
    );
  };

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

      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 pb-20 space-y-3">
        {activeTab === 'games' && (
          <div className="space-y-3">
            {renderGameContent()}
            {!selectedGame && <MiniGamesLeaderboardGrid />}
          </div>
        )}
        {activeTab === 'polls' && <PollSection playerName={player.name} />}
        {activeTab === 'youtube' && <YouTubeSection playerName={player.name} />}
        {activeTab === 'vibes' && <PositiveMessagesSection playerName={player.name} />}
        {activeTab === 'news' && <NewsSection />}
      </main>

      {/* Bottom tab bar - native app style */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t safe-area-bottom">
        <div className="grid grid-cols-5 h-[4.5rem]">
          {tabs.map(({ value, icon: Icon, label }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                onClick={() => {
                  setActiveTab(value);
                  if (value === 'games') setSelectedGame(null);
                }}
                className={`flex flex-col items-center justify-center gap-1.5 transition-colors active:scale-95 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                <Icon className={`h-7 w-7 ${value === 'vibes' && isActive ? 'fill-primary' : ''}`} />
                <span className="text-[0.7rem] font-semibold leading-none">{label}</span>
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
