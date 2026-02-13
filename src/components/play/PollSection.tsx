import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePolls } from '@/hooks/usePolls';
import { useDeviceId } from '@/hooks/useDeviceId';
import { BarChart3, Vote, Settings } from 'lucide-react';
import { PollVoteCard } from './PollVoteCard';
import { PollManagement } from './PollManagement';

interface PollSectionProps {
  playerName: string;
}

export function PollSection({ playerName }: PollSectionProps) {
  const deviceId = useDeviceId();
  const { activePolls } = usePolls();
  const [tab, setTab] = useState<'vote' | 'manage'>('vote');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Polls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-1 mb-4 bg-muted p-1 rounded-lg">
          <Button
            variant={tab === 'vote' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTab('vote')}
            className="flex items-center gap-1"
          >
            <Vote className="h-4 w-4" />
            Vote
          </Button>
          <Button
            variant={tab === 'manage' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setTab('manage')}
            className="flex items-center gap-1"
          >
            <Settings className="h-4 w-4" />
            Manage
          </Button>
        </div>

        {tab === 'vote' ? (
          activePolls.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              No active polls. Create one in Manage tab!
            </p>
          ) : (
            <div className="space-y-4">
              {activePolls.map((poll) => (
                <PollVoteCard
                  key={poll.id}
                  poll={poll}
                  deviceId={deviceId}
                  playerName={playerName}
                />
              ))}
            </div>
          )
        ) : (
          <PollManagement playerName={playerName} />
        )}
      </CardContent>
    </Card>
  );
}
