import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Component, type ReactNode, useEffect, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { useIsMobile } from '../hooks/use-mobile';
import { PlayerAuth } from '../components/play/PlayerAuth';
import { MobilePlayLayout } from '../components/play/MobilePlayLayout';
import { GuessMap } from '../components/play/GuessMap';
import { PollSection } from '../components/play/PollSection';
import { YouTubeSection } from '../components/play/YouTubeSection';
import { PositiveMessagesSection } from '../components/play/PositiveMessagesSection';
import { ChatSection } from '../components/play/ChatSection';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

import { MapPin, BarChart3, Youtube, Monitor, Heart, LogOut, UserCog, Gamepad2, Shield, MessageCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { OFFICE_FLAGS } from '@/hooks/usePlayer';
import { ProfileEditor } from '@/components/play/ProfileEditor';
import { AvatarPrompt } from '@/components/play/AvatarPrompt';
import { useDeviceId } from '@/hooks/useDeviceId';
import { usePresenceTrack } from '@/hooks/usePresenceCount';
import twigeoLogo from '@/assets/twigeo-logo.png';
import '@/styles/play-glass.css';

type TabValue = 'guess' | 'polls' | 'youtube' | 'vibes' | 'news' | 'chat';

/** Links from the TV page: /play?tab=chat, /play?game=sudoku */
const TAB_FROM_LINK: Record<string, TabValue> = {
  games: 'guess', ranks: 'guess', polls: 'polls', music: 'youtube', news: 'chat', kudos: 'vibes', chat: 'chat', // news now lives in the chat
};

class DesktopSectionBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="font-medium text-foreground">This section failed to load.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another tab and come back.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Desktop (lg and up): the chat gets its own column on the right, like on the TV */
const WIDE = '(min-width: 1024px)';
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mql = window.matchMedia(WIDE);
    const on = () => setWide(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return wide;
}

export default function PlayPage() {
  const { player, isLoading, setup, sendCode, verifyCode, claimProfile, createProfile, logout, updateProfile } = usePlayer();
  const isMobile = useIsMobile();
  const wide = useWide();
  const navigate = useNavigate();
  const deviceId = useDeviceId();
  const [params] = useSearchParams();
  const linkedGame = params.get('game');
  const [activeTab, setActiveTab] = useState<TabValue>(() => TAB_FROM_LINK[params.get('tab') ?? ''] ?? 'guess');
  const [showProfile, setShowProfile] = useState(false);
  const [gamesSubTab, setGamesSubTab] = useState<'easy' | 'hard' | 'other'>(linkedGame === 'geoguessr' ? 'easy' : 'other');
  const [gamesResetKey, setGamesResetKey] = useState(0);

  usePresenceTrack('app', {
    deviceId,
    playerName: player?.name,
    page: 'play',
  });

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>;
  }

  if (!player) {
    return <PlayerAuth setup={setup} onSendCode={sendCode} onVerify={verifyCode} onClaim={claimProfile} onCreate={createProfile} />;
  }

  if (isMobile) {
    return (
      <>
        <MobilePlayLayout player={player} logout={logout} updateProfile={updateProfile} />
        <AvatarPrompt key={player.id} player={player} onSave={updateProfile} />
      </>
    );
  }

  const tabs = [
    { value: 'guess' as const, icon: Gamepad2, label: 'Games' },
    { value: 'polls' as const, icon: BarChart3, label: 'Polls' },
    { value: 'youtube' as const, icon: Youtube, label: 'Music' },
    { value: 'vibes' as const, icon: Heart, label: 'Kudos' },
    { value: 'chat' as const, icon: MessageCircle, label: 'Chat' },
  ].filter((t) => !(wide && t.value === 'chat')); // on desktop the chat is always open on the right
  // A link to the chat on desktop: the chat is already there, so the left side shows the games
  const shownTab: TabValue = wide && activeTab === 'chat' ? 'guess' : activeTab;
  const openTab = (value: TabValue) => {
    setActiveTab(value);
    if (value === 'guess') {
      setGamesSubTab('other');
      setGamesResetKey((key) => key + 1);
    }
  };

  return (
    <div className="play-glass min-h-screen">
      <div className="tv-backdrop" aria-hidden><i /><i /><i /><i /></div>
      <AvatarPrompt key={player.id} player={player} onSave={updateProfile} />

      {/* Top bar: floating frosted glass, like the TV */}
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
        <div className="glass-bar mx-auto flex h-14 max-w-6xl items-center lg:max-w-[88rem] justify-between gap-3 rounded-full pl-4 pr-1.5 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex min-w-0 items-center gap-3 lg:justify-self-start">
            <img src={twigeoLogo} alt="Twigeo" className="h-6 w-auto object-contain" />
          </div>

          <nav className="hidden items-center gap-0.5 rounded-full bg-foreground/[0.04] p-1 lg:flex lg:justify-self-center">
            {tabs.map(({ value, icon: Icon, label }) => (
              <button
                type="button"
                key={value}
                onClick={() => openTab(value)}
                aria-current={shownTab === value ? 'page' : undefined}
                className="seg-tab h-9 px-3.5 text-sm"
              >
                <Icon className={`h-4 w-4 ${value === 'vibes' && shownTab === 'vibes' ? 'fill-primary' : ''}`} />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 lg:justify-self-end">
            <button
              type="button"
              onClick={() => navigate('/tv')}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <Monitor className="h-4 w-4" />
              TV mode
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-11 items-center gap-2 rounded-full bg-white/70 py-1 pl-1 pr-3 shadow-sm transition-colors hover:bg-white">
                  <PlayerAvatar avatar={player.avatar} name={player.name} size={34} />
                  <span className="text-sm font-medium">{player.name}</span>
                  <span className="text-xs">{OFFICE_FLAGS[player.office]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem className="gap-2" onClick={() => setShowProfile(true)}>
                  <UserCog className="h-4 w-4" />
                  Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={() => navigate('/manager')}>
                  <Shield className="h-4 w-4" />
                  Manager mode
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Content */}
      {/* Desktop: games, polls, music and kudos on the left (about 3/4), the chat always open on the right */}
      <main className="mx-auto max-w-[75rem] px-3 pb-10 pt-5 sm:px-6 lg:grid lg:max-w-[88rem] lg:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)] lg:items-start lg:gap-5">
        <div className="min-w-0">
        {/* Tablets: the tabs sit under the bar */}
        <nav className="glass-bar mb-4 grid grid-cols-5 gap-0.5 rounded-full p-1 lg:hidden">
          {tabs.map(({ value, icon: Icon, label }) => (
            <button
              type="button"
              key={value}
              onClick={() => openTab(value)}
              aria-current={shownTab === value ? 'page' : undefined}
              className="seg-tab h-9 px-2 text-sm"
            >
              <Icon className={`h-4 w-4 ${value === 'vibes' && shownTab === 'vibes' ? 'fill-primary' : ''}`} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <DesktopSectionBoundary>
          {shownTab === 'guess' && (
            <div className="space-y-4">
              <GuessMap playerName={player.name} onActiveTabChange={(tab) => {
                setGamesSubTab(tab);
              }} forcedTab={gamesSubTab} resetKey={gamesResetKey} initialGame={linkedGame && linkedGame !== 'geoguessr' ? linkedGame : null} />
            </div>
          )}
          {shownTab === 'polls' && <PollSection playerName={player.name} />}
          {shownTab === 'youtube' && <YouTubeSection playerName={player.name} />}
          {shownTab === 'vibes' && <PositiveMessagesSection playerName={player.name} />}
          {shownTab === 'chat' && <ChatSection playerName={player.name} />}
        </DesktopSectionBoundary>
        </div>

        {/* The chat column: stays in view while the left side scrolls, the box to write in always at the bottom */}
        {wide && (
          <aside className="sticky top-[5.5rem] h-[calc(100vh-6.75rem)] min-h-[420px]">
            <DesktopSectionBoundary>
              <ChatSection playerName={player.name} fill />
            </DesktopSectionBoundary>
          </aside>
        )}
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
