import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useState, useRef, useEffect } from 'react';
import { BarChart3, Gamepad2, LogOut, UserCog, Shield, Monitor, Trophy } from 'lucide-react';
import { MusicTabIcon, HeartTabIcon, PeaceTabIcon } from '@/components/HandTabIcons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Player } from '@/hooks/usePlayer';
import { GuessMap } from './GuessMap';
import { PollSection } from './PollSection';
import { YouTubeSection } from './YouTubeSection';
import { PositiveMessagesSection } from './PositiveMessagesSection';
import { ChatSection } from './ChatSection';
import twigeoLogo from '@/assets/twigeo-logo.png';
import { ProfileEditor } from './ProfileEditor';
import { OFFICE_FLAGS } from '@/hooks/usePlayer';
import { WordleGame } from './WordleGame';
import { CityGuessGame } from './games/CityGuessGame';
import { ColorMemoryGame } from './games/ColorMemoryGame';
import { ThisOrThatGame } from './games/ThisOrThatGame';
import { SudokuGame } from './games/SudokuGame';
import { PairsGame } from './games/PairsGame';
import { LabyrinthGame } from './games/LabyrinthGame';
import { RiddleGame } from './games/RiddleGame';
import riddleIcon from '@/assets/riddle-icon.svg';
import teamRiddleIcon from '@/assets/team-riddle-icon.svg';
import { TeamRiddleGame } from './games/TeamRiddleGame';
import { PlayHub } from './PlayHub';
import { TipPopup } from './TipPopup';
import { GameTile } from './GameTile';

/** Built-in icons for games that don't have one uploaded in Manager yet */
const LOCAL_ICONS: Record<string, string> = { riddle: riddleIcon, team_riddle: teamRiddleIcon };
import { MiniGamesLeaderboardGrid } from './MiniGamesLeaderboardGrid';
import { MINI_GAMES } from './miniGamesList';
import { useGameIcons } from '@/hooks/useGameIcons';
import { useRounds } from '@/hooks/useRounds';

type TabValue = 'games' | 'polls' | 'youtube' | 'vibes' | 'news' | 'leaderboards' | 'chat';

/** Links from the TV page: /play?tab=chat, /play?game=sudoku */
const TAB_FROM_LINK: Record<string, TabValue> = {
  games: 'games', ranks: 'leaderboards', polls: 'polls', music: 'youtube', news: 'chat', kudos: 'vibes', chat: 'chat', // news now lives in the chat
};

interface MobilePlayLayoutProps {
  player: Player;
  logout: () => void;
  updateProfile: (updates: { name?: string; office?: string; avatar?: string }) => Promise<{ ok: boolean; error?: string }>;
}

export function MobilePlayLayout({ player, logout, updateProfile }: MobilePlayLayoutProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabValue>(() => TAB_FROM_LINK[params.get('tab') ?? ''] ?? 'games');
  const [showProfile, setShowProfile] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(() => params.get('game'));
  const { icons } = useGameIcons();
  const { activeRound } = useRounds();

  useEffect(() => {
    const setAppHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    return () => window.removeEventListener('resize', setAppHeight);
  }, []);

  const tabs: { value: TabValue; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
    { value: 'games', icon: Gamepad2, label: 'Games' },
    { value: 'leaderboards', icon: Trophy, label: 'Ranks' },
    { value: 'polls', icon: BarChart3, label: 'Polls' },
    { value: 'youtube', icon: MusicTabIcon, label: 'Music' },
    { value: 'vibes', icon: HeartTabIcon, label: 'Kudos' },
    { value: 'chat', icon: PeaceTabIcon, label: 'Chat' },
  ];

  const renderGameContent = () => {
    if (!selectedGame) {
      return (
        <div className="space-y-3">
          <h2 className="px-1 text-xl font-bold tracking-tight">Games</h2>
          <PlayHub
            playerName={player.name}
            roundId={activeRound?.id}
            onOpenGame={(id) => setSelectedGame(id === 'geo' ? 'geoguessr' : id)}
          />
          <div className="grid grid-cols-3 gap-2">
            <GameTile id="geoguessr" name="GeoGuessr" icon={icons['geoguessr']} emoji="🎯" onClick={() => setSelectedGame('geoguessr')} />
            {MINI_GAMES.map((game) => (
              <GameTile
                key={game.id}
                id={game.id}
                name={game.name}
                icon={icons[game.id] ?? LOCAL_ICONS[game.id]}
                emoji={game.emoji}
                onClick={() => setSelectedGame(game.id)}
              />
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
        {selectedGame === 'wordle' && <WordleGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'city_guess' && <CityGuessGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'color_memory' && <ColorMemoryGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'this_or_that' && <ThisOrThatGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'sudoku' && <SudokuGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'pairs' && <PairsGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'labyrinth' && <LabyrinthGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'riddle' && <RiddleGame playerName={player.name} roundId={activeRound?.id} />}
        {selectedGame === 'team_riddle' && <TeamRiddleGame playerName={player.name} roundId={activeRound?.id} />}
      </div>
    );
  };

  return (
    <div className="play-glass flex flex-col" style={{ minHeight: 'var(--app-height, 100vh)', height: 'var(--app-height, 100vh)' }}>
      <div className="tv-backdrop" aria-hidden><i /><i /><i /><i /></div>
      {/* Compact top bar: floating frosted glass */}
      <header className="relative z-30 px-2 pt-2 safe-area-top">
        <div className="glass-bar flex h-14 items-center justify-between rounded-full pl-3 pr-1.5">
          <div className="flex items-center gap-2">
            <img src={twigeoLogo} alt="Twigeo" className="h-5 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/tv')}
              className="flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-primary transition-colors active:bg-primary/10"
            >
              <Monitor className="h-4 w-4" />
              <span>TV</span>
            </button>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-11 items-center gap-1.5 rounded-full bg-white/70 py-1 pl-1 pr-2.5 shadow-sm transition-colors active:bg-white"
            >
              <PlayerAvatar avatar={player.avatar} name={player.name} size={32} />
              <span className="max-w-[80px] truncate text-xs font-semibold">{player.name}</span>
              <span className="text-xs">{OFFICE_FLAGS[player.office]}</span>
            </button>
          </div>
        </div>

        {/* Dropdown menu - mobile friendly */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="glass-bar absolute right-3 top-full mt-2 z-50 min-w-[180px] overflow-hidden rounded-2xl">
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
      <main className={`flex-1 overflow-y-auto overscroll-y-contain px-3 pb-[6.5rem] lg:pb-[8rem] space-y-3 ${activeTab === 'games' && selectedGame ? 'pt-4' : 'pt-3'}`}>
        {activeTab === 'games' && renderGameContent()}
        {activeTab === 'leaderboards' && <MiniGamesLeaderboardGrid />}
        {activeTab === 'polls' && <PollSection playerName={player.name} />}
        {activeTab === 'youtube' && <YouTubeSection playerName={player.name} />}
        {activeTab === 'vibes' && <PositiveMessagesSection playerName={player.name} />}
        {activeTab === 'chat' && <ChatSection playerName={player.name} />}
      </main>

      {/* Bottom tabs: a floating frosted bar */}
      <nav className="fixed inset-x-2 z-30 bottom-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="glass-bar grid h-16 grid-cols-6 gap-0.5 rounded-[1.75rem] p-1 lg:h-[clamp(4.5rem,8vw,5.5rem)]">
          {tabs.map(({ value, icon: Icon, label }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                onClick={() => {
                  setActiveTab(value);
                  if (value === 'games') setSelectedGame(null);
                }}
                aria-current={isActive ? 'page' : undefined}
                className="seg-tab flex-col gap-1 rounded-[1.4rem] px-0.5 active:scale-95"
              >
                <Icon className={`h-[1.35rem] w-[1.35rem] lg:h-7 lg:w-7 ${value === 'vibes' && isActive ? 'text-primary' : ''}`} />
                <span className="text-[0.66rem] font-semibold leading-none lg:text-xs">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Once per visit: a tip about something this person hasn't tried yet */}
      <TipPopup
        playerName={player.name}
        onTry={(t) => {
          setActiveTab(t.tab);
          setSelectedGame(t.game ?? null);
        }}
      />

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
