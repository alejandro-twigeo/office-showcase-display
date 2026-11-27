import { useEffect, useMemo, useRef, useState } from "react";
import { usePollRotations } from "@/contexts/pollRotation";
import { Card } from "@/components/ui/card";
import { usePolls, useVotes } from "@/hooks/usePolls";
import { CountUp } from "@/components/ui/count-up";
import { useNavigate } from "react-router-dom";
import { useMe } from "@/hooks/useMe";
import { getDeviceId } from "@/hooks/useDeviceId";

export const ROTATE_SECONDS = 30;

export function PollDisplay() {
  const { activePolls, isLoading } = usePolls();

  const [currentPollId, setCurrentPollId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(ROTATE_SECONDS);

  const { rotations, setPollTimeLeft, increment } = usePollRotations();

  // Refs to avoid stale closures inside setInterval
  const currentPollIdRef = useRef<string | null>(null);
  const activePollsRef = useRef<typeof activePolls>([]);

  useEffect(() => {
    currentPollIdRef.current = currentPollId;
  }, [currentPollId]);

  useEffect(() => {
    activePollsRef.current = activePolls;
  }, [activePolls]);

  // Keep currentPollId valid whenever polls list changes
  useEffect(() => {
    if (activePolls.length === 0) {
      setCurrentPollId(null);
      setTimeLeft(ROTATE_SECONDS);
      setPollTimeLeft(ROTATE_SECONDS);
      return;
    }

    if (!currentPollId) {
      setCurrentPollId(activePolls[0].id);
      setTimeLeft(ROTATE_SECONDS);
      setPollTimeLeft(ROTATE_SECONDS);
      return;
    }

    const stillExists = activePolls.some((p) => p.id === currentPollId);
    if (!stillExists) {
      setCurrentPollId(activePolls[0].id);
      setTimeLeft(ROTATE_SECONDS);
      setPollTimeLeft(ROTATE_SECONDS);
    }
  }, [activePolls, currentPollId]);

  // Single interval that always uses latest refs
  useEffect(() => {
    if (activePolls.length === 0) {
      setPollTimeLeft(ROTATE_SECONDS);
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const polls = activePollsRef.current;
          if (polls.length === 0) {
            setPollTimeLeft(ROTATE_SECONDS);
            return ROTATE_SECONDS;
          }

          const curId = currentPollIdRef.current;
          const idx = polls.findIndex((p) => p.id === curId);
          const nextIdx = idx === -1 ? 0 : (idx + 1) % polls.length;

          setCurrentPollId(polls[nextIdx].id);
          increment();
          setPollTimeLeft(ROTATE_SECONDS);
          return ROTATE_SECONDS;
        }
        const newVal = prev - 1;
        setPollTimeLeft(newVal);
        return newVal;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activePolls.length]);

  const currentPoll = useMemo(
    () => activePolls.find((p) => p.id === currentPollId) ?? null,
    [activePolls, currentPollId],
  );

  const { votes, submitVote, updateVote } = useVotes(currentPoll?.id);

  // On a laptop the answers are clickable: vote (or change your vote) right here
  const navigate = useNavigate();
  const me = useMe();
  const myVote = me ? votes.find((v) => v.player_name === me) : undefined;
  const vote = (optionIndex: number) => {
    if (!currentPoll) return;
    if (!me) return navigate("/play?tab=polls");
    if (myVote) {
      if (myVote.option_index !== optionIndex) updateVote.mutate({ voteId: myVote.id, option_index: optionIndex });
    } else {
      submitVote.mutate({ poll_id: currentPoll.id, device_id: getDeviceId(), player_name: me, option_index: optionIndex });
    }
  };

  const voteCounts = useMemo(() => {
    if (!currentPoll) return [];
    return (currentPoll.options as string[]).map((_, index) => {
      return votes.filter((v) => v.option_index === index).length;
    });
  }, [currentPoll, votes]);

  const totalVotes = voteCounts.reduce((a, b) => a + b, 0);

  // For freetext polls, sort options by vote count descending
  const sortedFreetextOptions = useMemo(() => {
    if (!currentPoll || (currentPoll as any).poll_type !== "freetext") return [];
    return (currentPoll.options as string[])
      .map((text, idx) => ({ text, idx, count: voteCounts[idx] ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // show top 8 on TV
  }, [currentPoll, voteCounts]);

  const isFreetext = (currentPoll as any)?.poll_type === "freetext";
  const rows = !currentPoll
    ? []
    : isFreetext
      ? sortedFreetextOptions.map(({ text, idx, count }) => ({ key: idx, label: text, count }))
      : (currentPoll.options as string[]).map((label, idx) => ({ key: idx, label, count: voteCounts[idx] || 0 }));
  const topCount = Math.max(0, ...rows.map((r) => r.count));
  const byline = (currentPoll as any)?.created_by;

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden p-[clamp(14px,1.3vw,28px)] gap-[clamp(10px,0.9vw,18px)]">
      <div className="flex items-center justify-between gap-3">
        <span className="tile-label">Poll{byline === "Daily poll ✨" ? " of the day" : ""}</span>
        {currentPoll && rows.length > 0 && (
          <span className="tile-label tabular-nums">
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="m-auto text-muted-foreground text-[clamp(14px,1vw,20px)]">Loading…</p>
      ) : !currentPoll ? (
        <div className="m-auto text-center">
          <p className="font-semibold text-[clamp(20px,1.6vw,34px)] leading-tight">No poll right now</p>
          <p className="mt-1 text-muted-foreground text-[clamp(13px,0.9vw,18px)]">A new one arrives with the daily reset</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-[clamp(8px,0.7vw,14px)] overflow-hidden">
          <h3 className="shrink-0 font-semibold tracking-tight leading-[1.1] text-[clamp(18px,1.4vw,30px)] text-balance line-clamp-2">
            {currentPoll.question}
          </h3>

          {rows.length === 0 ? (
            <p className="text-muted-foreground text-[clamp(14px,1vw,20px)]">No answers yet. Add yours from the Play page</p>
          ) : (
            <div className="min-h-0 flex flex-col gap-[clamp(5px,0.4vw,9px)] overflow-hidden">
              {rows.map(({ key, label, count }) => {
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const leading = count > 0 && count === topCount;
                const mine = myVote?.option_index === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => vote(key)}
                    className="block w-full min-w-0 rounded-md text-left [@media(hover:hover)]:hover:bg-primary/[0.06] [@media(hover:hover)]:hover:shadow-[0_0_0_4px_hsl(var(--primary)/0.06)]"
                    title={me ? (mine ? "Your vote" : "Vote for this") : "Log in on the Play page to vote"}
                  >
                    {/* Tall bar with the answer and the % inside it */}
                    <div className="relative flex h-[clamp(30px,2.25vw,48px)] items-center overflow-hidden rounded-[clamp(8px,0.6vw,12px)] bg-secondary/70">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-[inherit] transition-[width] duration-700 ease-out ${leading ? "bg-primary/35" : "bg-foreground/[0.09]"}`}
                        style={{ width: `${pct}%` }}
                      />
                      <span className={`relative min-w-0 flex-1 truncate px-[clamp(10px,0.8vw,16px)] text-[clamp(13px,0.95vw,20px)] ${leading ? "font-semibold" : "font-medium"}`}>
                        {mine && <span className="text-primary">✓ </span>}
                        {label}
                      </span>
                      <span className={`relative shrink-0 pr-[clamp(10px,0.8vw,16px)] tabular-nums text-[clamp(13px,0.95vw,20px)] ${leading ? "font-semibold" : "text-muted-foreground"}`}>
                        <CountUp value={pct} />%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rotation timer when several polls take turns */}
      {currentPoll && activePolls.length > 1 && (
        <div className="h-[2px] rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-foreground/30 transition-[width] duration-1000 ease-linear" style={{ width: `${(timeLeft / ROTATE_SECONDS) * 100}%` }} />
        </div>
      )}
    </Card>
  );
}
