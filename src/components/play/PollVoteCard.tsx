import { useState } from 'react';
import { useVotes, usePolls, type Poll } from '@/hooks/usePolls';
import { Check, Vote, ThumbsUp, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PollVoteCardProps {
  poll: Poll;
  deviceId: string;
  playerName: string;
}

export function PollVoteCard({ poll, deviceId, playerName }: PollVoteCardProps) {
  const { votes, submitVote } = useVotes(poll.id);
  const { appendOption } = usePolls();
  const [freeText, setFreeText] = useState('');

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

  const handleUpvote = (optionIndex: number) => {
    if (!userVote && deviceId) {
      submitVote.mutate({
        poll_id: poll.id,
        device_id: deviceId,
        player_name: playerName,
        option_index: optionIndex,
      });
    }
  };

  const handleSubmitFreeText = async () => {
    if (!freeText.trim() || !deviceId || userVote) return;
    try {
      // Append the option (or get existing index if duplicate)
      const index = await appendOption.mutateAsync({ pollId: poll.id, text: freeText.trim() });
      // Then cast a vote for it
      submitVote.mutate({
        poll_id: poll.id,
        device_id: deviceId,
        player_name: playerName,
        option_index: index,
      });
      setFreeText('');
    } catch {
      // ignore
    }
  };

  const getVoteCount = (index: number) => votes.filter((v) => v.option_index === index).length;
  const totalVotes = votes.length;

  /* ── CHOICE poll ────────────────────────────────────── */
  if (poll.poll_type === 'choice') {
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

  /* ── FREETEXT poll ──────────────────────────────────── */
  const sortedOptions = [...poll.options]
    .map((text, idx) => ({ text, idx, count: getVoteCount(idx) }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div>
        <p className="font-medium">{poll.question}</p>
        <p className="text-xs text-muted-foreground">by {poll.created_by} · free-text poll</p>
      </div>

      {/* Submit a new answer (only if hasn't voted) */}
      {!userVote && (
        <div className="flex gap-2">
          <Input
            placeholder="Type your answer…"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitFreeText()}
            maxLength={120}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleSubmitFreeText}
            disabled={!freeText.trim() || appendOption.isPending || submitVote.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Existing answers to upvote */}
      {sortedOptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {userVote ? 'Results:' : 'Or upvote an existing answer:'}
          </p>
          {sortedOptions.map(({ text, idx, count }) => {
            const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            const isSelected = userVote?.option_index === idx;

            return (
              <div
                key={idx}
                className={`relative rounded-md border overflow-hidden ${
                  isSelected ? 'border-primary' : 'border-border'
                }`}
              >
                {/* vote bar background */}
                {userVote && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/15 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between gap-2 px-3 py-2">
                  <span className={`text-sm flex-1 ${isSelected ? 'text-primary font-medium' : ''}`}>
                    {isSelected && <Check className="inline h-3.5 w-3.5 mr-1" />}
                    {text}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {userVote && (
                      <span className="text-xs text-muted-foreground">
                        {count} ({Math.round(percentage)}%)
                      </span>
                    )}
                    {!userVote && (
                      <button
                        onClick={() => handleUpvote(idx)}
                        disabled={submitVote.isPending}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-primary/10"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {count > 0 && count}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!userVote && poll.options.length === 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Be the first to answer!
        </p>
      )}
    </div>
  );
}
