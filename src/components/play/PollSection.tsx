import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Polls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="vote" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="vote" className="flex items-center gap-1">
              <Vote className="h-4 w-4" />
              Vote
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              Manage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vote" className="space-y-4">
            {activePolls.length === 0 ? (
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
            )}
          </TabsContent>

          <TabsContent value="manage">
            <PollManagement playerName={playerName} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
