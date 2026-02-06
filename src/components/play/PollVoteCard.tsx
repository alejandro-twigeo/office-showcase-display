import { useVotes } from '@/hooks/usePolls';
import { Check, Vote } from 'lucide-react';

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

export function PollVoteCard({ poll, deviceId, playerName }: PollVoteCardProps) {
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
