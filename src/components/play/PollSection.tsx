import { Component, type ReactNode, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePolls } from '@/hooks/usePolls';
import { useDeviceId } from '@/hooks/useDeviceId';
import { BarChart3, Vote, Settings } from 'lucide-react';
import { PollVoteCard } from './PollVoteCard';
import { PollManagement } from './PollManagement';
import { useIsMobile } from '@/hooks/use-mobile';

interface PollSectionProps {
  playerName: string;
}

class PollPaneBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.setState({ message });
    console.error('Poll pane render failed:', error);
  }

  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, message: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border bg-secondary/20 p-4 text-center">
          <p className="font-medium text-foreground">This poll pane failed to load.</p>
          <p className="mt-1 text-xs text-muted-foreground">Switch tabs and come back after the next fix.</p>
          {this.state.message && (
            <p className="mt-2 break-words text-xs text-destructive">{this.state.message}</p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export function PollSection({ playerName }: PollSectionProps) {
  const deviceId = useDeviceId();
  const { activePolls } = usePolls();
  const [tab, setTab] = useState<'vote' | 'manage'>('vote');
  const isMobile = useIsMobile();

  const voting = (
    <PollPaneBoundary>
      {activePolls.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No active polls right now. {isMobile ? 'Create one in Manage.' : 'Create one below.'}
        </p>
      ) : (
        <div className="space-y-4">
          {activePolls.map((poll) => (
            <PollVoteCard key={poll.id} poll={poll} deviceId={deviceId} playerName={playerName} />
          ))}
        </div>
      )}
    </PollPaneBoundary>
  );
  const managing = (
    <PollPaneBoundary>
      <PollManagement playerName={playerName} />
    </PollPaneBoundary>
  );

  // Desktop has room for both: vote first, then create and manage underneath
  if (!isMobile) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Vote className="h-5 w-5 text-primary" />
              Vote
            </CardTitle>
          </CardHeader>
          <CardContent>{voting}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-primary" />
              Create and manage polls
            </CardTitle>
          </CardHeader>
          <CardContent>{managing}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Polls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-2 gap-0.5 rounded-full bg-foreground/[0.05] p-1">
          <button onClick={() => setTab('vote')} aria-current={tab === 'vote' ? 'page' : undefined} className="seg-tab h-9 text-sm">
            <Vote className="h-4 w-4" />
            Vote
          </button>
          <button onClick={() => setTab('manage')} aria-current={tab === 'manage' ? 'page' : undefined} className="seg-tab h-9 text-sm">
            <Settings className="h-4 w-4" />
            Manage
          </button>
        </div>
        {tab === 'vote' ? voting : managing}
      </CardContent>
    </Card>
  );
}
