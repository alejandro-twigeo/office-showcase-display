import { useState } from "react";
import { useVotes, usePolls, type Poll } from "@/hooks/usePolls";
import { Check, Vote, ThumbsUp, Send, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PollVoteCardProps {
  poll: Poll;
  deviceId: string;
  playerName: string;
}

export function PollVoteCard({ poll, deviceId, playerName }: PollVoteCardProps) {
  const { votes, submitVote, updateVote } = useVotes(poll.id);
  const { appendOption } = usePolls();
  const [freeText, setFreeText] = useState("");
  const [isChangingVote, setIsChangingVote] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState("");

  const userVote = votes.find((v) => v.device_id === deviceId);

  const handleVote = (optionIndex: number) => {
    if (userVote && isChangingVote) {
      updateVote.mutate(
        { voteId: userVote.id, option_index: optionIndex },
        { onSuccess: () => setIsChangingVote(false) }
      );
    } else if (!userVote && deviceId) {
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
    } else if (userVote && isChangingVote) {
      updateVote.mutate(
        { voteId: userVote.id, option_index: optionIndex },
        { onSuccess: () => setIsChangingVote(false) }
      );
    }
  };

  const handleSubmitFreeText = async () => {
    if (!freeText.trim() || !deviceId || userVote) return;
    try {
      const index = await appendOption.mutateAsync({ pollId: poll.id, text: freeText.trim() });
      submitVote.mutate({
        poll_id: poll.id,
        device_id: deviceId,
        player_name: playerName,
        option_index: index,
      });
      setFreeText("");
    } catch {
      // ignore
    }
  };

  const handleEditFreeText = async () => {
    if (!editText.trim() || !userVote) return;
    try {
      const newIndex = await appendOption.mutateAsync({ pollId: poll.id, text: editText.trim() });
      updateVote.mutate(
        { voteId: userVote.id, option_index: newIndex },
        {
          onSuccess: () => {
            setIsEditingText(false);
            setEditText("");
          },
        }
      );
    } catch {
      // ignore
    }
  };

  const getVoteCount = (index: number) => votes.filter((v) => v.option_index === index).length;
  const totalVotes = votes.length;

  /* ── CHOICE poll ────────────────────────────────────── */
  if (poll.poll_type === "choice") {
    const canInteract = !userVote || isChangingVote;

    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div>
          <p className="font-medium">{poll.question}</p>
          <p className="text-xs text-muted-foreground">by {poll.created_by}</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {poll.options.map((option, index) => {
            const count = getVoteCount(index);
            const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            const isSelected = userVote?.option_index === index;

            return (
              <button
                key={index}
                onClick={() => handleVote(index)}
                disabled={!canInteract || submitVote.isPending || updateVote.isPending}
                className={`w-full text-left px-2.5 py-1.5 min-h-[40px] rounded-md border transition-colors relative overflow-hidden ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : isChangingVote
                      ? "border-border hover:border-primary/50 hover:bg-secondary/50"
                      : userVote
                        ? "border-border bg-secondary/20"
                        : "border-border hover:border-primary/50 hover:bg-secondary/50"
                }`}
              >
                {userVote && !isChangingVote && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/20 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                )}
                <div className="relative flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 text-sm truncate">
                    {isSelected && !isChangingVote && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    {option}
                  </span>
                  {userVote && !isChangingVote && (
                    <span className="text-xs text-muted-foreground">
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
        {userVote && !isChangingVote && (
          <button
            onClick={() => setIsChangingVote(true)}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mx-auto transition-colors"
          >
            <Pencil className="h-3 w-3" /> Change vote
          </button>
        )}
        {isChangingVote && (
          <div className="flex items-center justify-center gap-2">
            <p className="text-xs text-primary">Tap a new option</p>
            <button
              onClick={() => setIsChangingVote(false)}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── FREETEXT poll ──────────────────────────────────── */
  const sortedOptions = [...poll.options]
    .map((text, idx) => ({ text, idx, count: getVoteCount(idx) }))
    .sort((a, b) => b.count - a.count);

  const canInteractFreetext = !userVote || isChangingVote;

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
            onKeyDown={(e) => e.key === "Enter" && handleSubmitFreeText()}
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

      {/* Edit answer inline */}
      {userVote && isEditingText && (
        <div className="flex gap-2">
          <Input
            placeholder="Edit your answer…"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEditFreeText()}
            maxLength={120}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleEditFreeText}
            disabled={!editText.trim() || appendOption.isPending || updateVote.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setIsEditingText(false); setEditText(""); }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Existing answers to upvote */}
      {sortedOptions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {canInteractFreetext && userVote ? "Tap to change your vote:" : userVote ? "Results:" : "Or upvote an existing answer:"}
          </p>
          {sortedOptions.map(({ text, idx, count }) => {
            const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            const isSelected = userVote?.option_index === idx;

            return (
              <div
                key={idx}
                className={`relative rounded-md border overflow-hidden ${
                  isSelected ? "border-primary" : "border-border"
                }`}
              >
                {/* vote bar background */}
                {userVote && !isChangingVote && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/15 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between gap-2 px-3 py-2">
                  <span className={`text-sm flex-1 ${isSelected ? "text-primary font-medium" : ""}`}>
                    {isSelected && !isChangingVote && <Check className="inline h-3.5 w-3.5 mr-1" />}
                    {text}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {userVote && !isChangingVote && (
                      <span className="text-xs text-muted-foreground">
                        {count} ({Math.round(percentage)}%)
                      </span>
                    )}
                    {canInteractFreetext && isChangingVote && (
                      <button
                        onClick={() => handleUpvote(idx)}
                        disabled={updateVote.isPending}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-primary/10"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {count > 0 && count}
                      </button>
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

      {/* Change vote / edit text actions */}
      {userVote && !isChangingVote && !isEditingText && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setIsChangingVote(true)}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Change vote
          </button>
          <button
            onClick={() => {
              setIsEditingText(true);
              const currentText = poll.options[userVote.option_index] ?? "";
              setEditText(currentText);
            }}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Edit my answer
          </button>
        </div>
      )}
      {isChangingVote && (
        <div className="flex items-center justify-center gap-2">
          <p className="text-xs text-primary">Tap an option to change your vote</p>
          <button
            onClick={() => setIsChangingVote(false)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Cancel
          </button>
        </div>
      )}

      {!userVote && poll.options.length === 0 && (
        <p className="text-xs text-center text-muted-foreground">Be the first to answer!</p>
      )}
    </div>
  );
}
