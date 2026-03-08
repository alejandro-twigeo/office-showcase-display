import { useEffect, useMemo, useRef, useState } from "react";
import { usePollRotations } from "@/contexts/pollRotation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePolls, useVotes } from "@/hooks/usePolls";
import { BarChart3, Clock, Users } from "lucide-react";

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

  const { votes } = useVotes(currentPoll?.id);

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

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden">
      <CardHeader className="pb-1 pt-3 px-3 lg:pb-2 lg:pt-6 lg:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm lg:text-[clamp(20px,1.5vw,28px)]">
            <BarChart3 className="h-4 w-4 lg:h-[clamp(18px,1.2vw,26px)] lg:w-[clamp(18px,1.2vw,26px)] text-primary" />
            Live Poll
          </CardTitle>
          {currentPoll && (
            <div className="flex items-center gap-2 text-[clamp(14px,1vw,20px)] text-muted-foreground">
              <Clock className="h-[clamp(14px,1vw,20px)] w-[clamp(14px,1vw,28px)]" />
              <span className="font-mono">{timeLeft}s</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="text-center flex flex-col items-center justify-center h-full">
            <BarChart3 className="h-[clamp(32px,3vw,64px)] w-[clamp(32px,3vw,64px)] text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-[clamp(14px,1vw,20px)]">Loading polls…</p>
          </div>
        ) : !currentPoll ? (
          <div className="text-center flex flex-col items-center justify-center h-full">
            <BarChart3 className="h-[clamp(32px,3vw,64px)] w-[clamp(32px,3vw,64px)] text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-[clamp(14px,1vw,20px)]">No active polls</p>
            <p className="text-muted-foreground text-[clamp(12px,0.8vw,16px)] mt-1">Create one from the Play page!</p>
          </div>
        ) : (currentPoll as any).poll_type === "freetext" ? (
          /* ── Freetext poll display ── */
          <div className="space-y-[clamp(8px,0.8vw,16px)]">
            <Progress value={(timeLeft / ROTATE_SECONDS) * 100} className="h-[clamp(3px,0.2vw,6px)]" />
            <h3 className="font-semibold text-[clamp(18px,1.4vw,28px)]">{currentPoll.question}</h3>
            {sortedFreetextOptions.length === 0 ? (
              <p className="text-muted-foreground text-[clamp(14px,1vw,20px)]">
                No answers yet — submit one from the Play page!
              </p>
            ) : (
              <div className="space-y-[clamp(4px,0.35vw,7px)]">
                {sortedFreetextOptions.map(({ text, idx, count }) => {
                  const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="relative flex-1 h-[clamp(26px,1.9vw,38px)] bg-secondary rounded-md overflow-hidden">
                        <div
                          className="h-full bg-primary/80 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-3 text-[clamp(12px,0.85vw,18px)] font-medium truncate">
                          {text}
                        </span>
                      </div>

                      <div className="shrink-0 text-muted-foreground text-[clamp(12px,0.85vw,18px)] tabular-nums">
                        {count} ({Math.round(percentage)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 text-[clamp(14px,1vw,20px)] text-muted-foreground pt-1">
              <Users className="h-[clamp(14px,1vw,20px)] w-[clamp(14px,1vw,22px)]" />
              <span>
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""} · {(currentPoll.options as string[]).length} answers
              </span>
            </div>
          </div>
        ) : (
          /* ── Choice poll display ── */
          <div className="space-y-[clamp(8px,0.8vw,16px)]">
            <div>
              <Progress value={(timeLeft / ROTATE_SECONDS) * 100} className="h-[clamp(3px,0.2vw,6px)]" />
            </div>

            <h3 className="font-semibold text-[clamp(18px,1.4vw,28px)]">{currentPoll.question}</h3>

            <div className="space-y-[clamp(6px,0.6vw,12px)]">
              {(currentPoll.options as string[]).map((option, index) => {
                const count = voteCounts[index] || 0;
                const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;

                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="relative flex-1 h-[clamp(30px,2vw,40px)] bg-secondary rounded-md overflow-hidden">
                      <div
                        className="h-full bg-primary/80 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-3 text-[clamp(14px,1vw,20px)] font-medium truncate">
                        {option}
                      </span>
                    </div>

                    <div className="shrink-0 text-muted-foreground text-[clamp(12px,0.9vw,18px)] tabular-nums">
                      {count} ({Math.round(percentage)}%)
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-[clamp(14px,1vw,20px)] text-muted-foreground pt-1">
              <Users className="h-[clamp(14px,1vw,20px)] w-[clamp(14px,1vw,22px)]" />
              <span>
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
