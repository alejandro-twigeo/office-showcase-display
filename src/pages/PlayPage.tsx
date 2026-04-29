import { Component, type ReactNode, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { useIsMobile } from '../hooks/use-mobile';
import { PlayerAuth } from '../components/play/PlayerAuth';
import { MobilePlayLayout } from '../components/play/MobilePlayLayout';
import { GuessMap } from '../components/play/GuessMap';
import { PollSection } from '../components/play/PollSection';
import { YouTubeSection } from '../components/play/YouTubeSection';
import { PositiveMessagesSection } from '../components/play/PositiveMessagesSection';
import { NewsSection } from '../components/play/NewsSection';
import { PlantStatus } from '../components/dashboard/PlantStatus';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

import { MapPin, BarChart3, Youtube, Monitor, Heart, LogOut, UserCog, Gamepad2, Newspaper, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OFFICE_FLAGS } from '@/hooks/usePlayer';
import { ProfileEditor } from '@/components/play/ProfileEditor';
import { useDeviceId } from '@/hooks/useDeviceId';
import { usePresenceTrack } from '@/hooks/usePresenceCount';

type TabValue = 'guess' | 'polls' | 'youtube' | 'vibes' | 'news';

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

export default function PlayPage() {
  const { player, isLoading, login, signup, logout, updateProfile } = usePlayer();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const deviceId = useDeviceId();
  const [activeTab, setActiveTab] = useState<TabValue>('guess');
  const [showProfile, setShowProfile] = useState(false);
  const [gamesSubTab, setGamesSubTab] = useState<'easy' | 'hard' | 'other'>('other');
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
    return <PlayerAuth onLogin={login} onSignup={signup} />;
  }

  if (isMobile) {
    return <MobilePlayLayout player={player} logout={logout} updateProfile={updateProfile} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <style>{`
          .desktop-target-nav {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.75rem 1rem;
            border-radius: 9999px;
            color: rgb(100 116 139);
            transition:
              color 180ms ease,
              background-color 180ms ease,
              box-shadow 180ms ease,
              transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
            overflow: hidden;
            isolation: isolate;
          }

          .desktop-target-nav::before,
          .desktop-target-nav::after {
            content: '';
            position: absolute;
            inset: auto;
            border-radius: 9999px;
            pointer-events: none;
            opacity: 0;
            transition:
              opacity 180ms ease,
              transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
            z-index: 0;
          }

          .desktop-target-nav::before {
            width: 4.4rem;
            height: 4.4rem;
            left: -0.85rem;
            top: -1rem;
            background: radial-gradient(circle, rgba(251,146,60,0.24) 0%, rgba(251,146,60,0.1) 45%, transparent 72%);
            filter: blur(8px);
            transform: translate(-0.65rem, -0.45rem) scale(0.82);
          }

          .desktop-target-nav::after {
            width: 3.4rem;
            height: 3.4rem;
            right: -0.35rem;
            bottom: -0.7rem;
            background: radial-gradient(circle, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0.08) 42%, transparent 72%);
            filter: blur(10px);
            transform: translate(0.55rem, 0.45rem) scale(0.88);
          }

          .desktop-target-nav:hover {
            color: rgb(154 52 18);
            background: linear-gradient(180deg, rgba(255,247,237,0.98), rgba(255,237,213,0.96));
            box-shadow: 0 10px 22px rgba(251, 146, 60, 0.14);
            transform: translateY(-1px);
          }

          .desktop-target-nav:hover::before,
          .desktop-target-nav:hover::after {
            opacity: 1;
          }

          .desktop-target-nav:hover::before {
            transform: translate(0.1rem, 0.05rem) scale(1.02);
          }

          .desktop-target-nav:hover::after {
            transform: translate(-0.1rem, -0.12rem) scale(1.04);
          }

          .desktop-target-nav-active {
            background: rgb(254 215 170);
            color: rgb(124 45 18);
            box-shadow: 0 12px 26px rgba(249, 115, 22, 0.18);
          }

          .desktop-target-nav-active::before,
          .desktop-target-nav-active::after {
            opacity: 1;
          }

          .desktop-target-nav > * {
            position: relative;
            z-index: 1;
          }
        `}</style>
        <div className="max-w-[96vw] sm:max-w-lg lg:max-w-[90vw] xl:max-w-[92vw] mx-auto flex items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="flex items-center gap-3 lg:justify-self-start">
            <button
              type="button"
              onClick={() => navigate('/tv')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-primary text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
            >
              <Monitor className="h-4 w-4" />
              <span>TV mode</span>
            </button>
              <PlantStatus playerName={player.name} />
          </div>
          <div className="hidden lg:flex lg:justify-self-center">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-2 py-1 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur">
              {([
                { value: 'guess' as const, icon: Gamepad2, label: 'Games' },
                { value: 'polls' as const, icon: BarChart3, label: 'Polls' },
                { value: 'youtube' as const, icon: Youtube, label: 'Music' },
                { value: 'news' as const, icon: Newspaper, label: 'News' },
                { value: 'vibes' as const, icon: Heart, label: 'Vibes' },
              ]).map(({ value, icon: Icon, label }) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => {
                    setActiveTab(value);
                    if (value === 'guess') {
                      setGamesSubTab('other');
                      setGamesResetKey((key) => key + 1);
                    }
                  }}
                  className={`desktop-target-nav ${activeTab === value ? 'desktop-target-nav-active' : ''}`}
                >
                  <Icon className={`h-4 w-4 ${value === 'vibes' && activeTab === 'vibes' ? 'fill-primary text-primary' : ''}`} />
                  <span className="text-base font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground lg:justify-self-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 p-1 rounded-full hover:bg-secondary/60 transition-colors">
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
        <div className="grid grid-cols-5 gap-1 bg-muted/70 p-1 rounded-lg mb-4 lg:hidden">
          {([
            { value: 'guess' as const, icon: Gamepad2, label: 'Games' },
            { value: 'polls' as const, icon: BarChart3, label: 'Polls' },
            { value: 'youtube' as const, icon: Youtube, label: 'Music' },
            { value: 'news' as const, icon: Newspaper, label: 'News' },
            { value: 'vibes' as const, icon: Heart, label: 'Vibes' },
          ]).map(({ value, icon: Icon, label }) => (
            <button
              type="button"
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center justify-center gap-1 lg:gap-2 rounded-md px-2 lg:px-4 py-1.5 lg:py-2 text-sm lg:text-base font-medium transition-all ${
                activeTab === value
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }`}
            >
              <Icon className={`h-4 w-4 lg:h-5 lg:w-5 ${value === 'vibes' && activeTab === 'vibes' ? 'fill-primary text-primary' : ''}`} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <DesktopSectionBoundary>
          {activeTab === 'guess' && (
            <div className="space-y-4">
              <GuessMap playerName={player.name} onActiveTabChange={(tab) => {
                setGamesSubTab(tab);
              }} forcedTab={gamesSubTab} resetKey={gamesResetKey} />
            </div>
          )}
          {activeTab === 'polls' && <PollSection playerName={player.name} />}
          {activeTab === 'youtube' && <YouTubeSection playerName={player.name} />}
          {activeTab === 'vibes' && <PositiveMessagesSection playerName={player.name} />}
          {activeTab === 'news' && <NewsSection />}
        </DesktopSectionBoundary>
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
