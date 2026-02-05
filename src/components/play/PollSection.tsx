import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePolls, useVotes } from '@/hooks/usePolls';
import { useDeviceId } from '@/hooks/useDeviceId';
import { BarChart3, Plus, Check, Vote } from 'lucide-react';

interface PollSectionProps {
  playerName: string;
}

export function PollSection({ playerName }: PollSectionProps) {
  const deviceId = useDeviceId();
  const { activePolls, createPoll } = usePolls();
  const [showCreate, setShowCreate] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);

  const handleCreatePoll = () => {
    const validOptions = newOptions.filter((o) => o.trim());
    if (newQuestion.trim() && validOptions.length >= 2) {
      createPoll.mutate(
        {
          question: newQuestion.trim(),
          options: validOptions,
          created_by: playerName,
        },
        {
          onSuccess: () => {
            setNewQuestion('');
            setNewOptions(['', '']);
            setShowCreate(false);
          },
        }
      );
    }
  };

  const addOption = () => {
    if (newOptions.length < 4) {
      setNewOptions([...newOptions, '']);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Polls
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Poll
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreate && (
          <div className="border rounded-lg p-4 space-y-3 bg-secondary/20">
            <Input
              placeholder="Ask a question..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
            />
            {newOptions.map((option, i) => (
              <Input
                key={i}
                placeholder={`Option ${i + 1}`}
                value={option}
                onChange={(e) => {
                  const updated = [...newOptions];
                  updated[i] = e.target.value;
                  setNewOptions(updated);
                }}
              />
            ))}
            <div className="flex gap-2">
              {newOptions.length < 4 && (
                <Button variant="outline" size="sm" onClick={addOption}>
                  Add Option
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleCreatePoll}
                disabled={
                  !newQuestion.trim() ||
                  newOptions.filter((o) => o.trim()).length < 2 ||
                  createPoll.isPending
                }
              >
                Create Poll
              </Button>
            </div>
          </div>
        )}

        {activePolls.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">
            No active polls. Create one!
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
      </CardContent>
    </Card>
  );
}

interface PollVoteCardProps {
  poll: {
    id: string;
    question: string;
    options: string[];
    created_by: string;
  };
  deviceId: string;
  playerName: string;
}

function PollVoteCard({ poll, deviceId, playerName }: PollVoteCardProps) {
  const { votes, submitVote } = useVotes(poll.id);
  const userVote = votes.find((v) => v.device_id === deviceId);

  const handleVote = (optionIndex: number) => {
    if (!userVote && deviceId) {
      submitVote.mutate({
        poll_id: poll.id,
        device_id: deviceId,
        player_name: playerName,
        option_index: optionIndex,
      });
    }
  };

  const getVoteCount = (index: number) => {
    return votes.filter((v) => v.option_index === index).length;
  };

  const totalVotes = votes.length;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div>
        <p className="font-medium">{poll.question}</p>
        <p className="text-xs text-muted-foreground">by {poll.created_by}</p>
      </div>
      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const count = getVoteCount(index);
          const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
          const isSelected = userVote?.option_index === index;

          return (
            <button
              key={index}
              onClick={() => handleVote(index)}
              disabled={!!userVote || submitVote.isPending}
              className={`w-full text-left p-3 rounded-md border transition-colors relative overflow-hidden ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : userVote
                  ? 'border-border bg-secondary/20'
                  : 'border-border hover:border-primary/50 hover:bg-secondary/50'
              }`}
            >
              {userVote && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary/20 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                  {option}
                </span>
                {userVote && (
                  <span className="text-sm text-muted-foreground">
                    {count} ({Math.round(percentage)}%)
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {!userVote && (
        <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Vote className="h-3 w-3" /> Tap to vote
        </p>
      )}
    </div>
  );
}
