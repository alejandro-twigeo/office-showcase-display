import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePolls, useVotes } from "@/hooks/usePolls";
import { BarChart3, Clock, Users } from "lucide-react";

const ROTATE_SECONDS = 30;

export function PollDisplay() {
  const { activePolls, isLoading } = usePolls(); 


  const [currentPollId, setCurrentPollId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(ROTATE_SECONDS);

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
      return;
    }

    if (!currentPollId) {
      setCurrentPollId(activePolls[0].id);
      setTimeLeft(ROTATE_SECONDS);
      return;
    }

    const stillExists = activePolls.some((p) => p.id === currentPollId);
    if (!stillExists) {
      setCurrentPollId(activePolls[0].id);
      setTimeLeft(ROTATE_SECONDS);
    }
  }, [activePolls, currentPollId]);

  // Single interval that always uses latest refs
  useEffect(() => {
    if (activePolls.length === 0) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const polls = activePollsRef.current;
          if (polls.length === 0) return ROTATE_SECONDS;

          const curId = currentPollIdRef.current;
          const idx = polls.findIndex((p) => p.id === curId);
          const nextIdx = idx === -1 ? 0 : (idx + 1) % polls.length;

          setCurrentPollId(polls[nextIdx].id);
          return ROTATE_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activePolls.length]);

  const currentPoll = useMemo(
    () => activePolls.find((p) => p.id === currentPollId) ?? null,
    [activePolls, currentPollId]
  );

  const { votes } = useVotes(currentPoll?.id);

  const voteCounts = useMemo(() => {
    if (!currentPoll) return [];
    return (currentPoll.options as string[]).map((_, index) => {
      return votes.filter((v) => v.option_index === index).length;
    });
  }, [currentPoll, votes]);

  const totalVotes = voteCounts.reduce((a, b) => a + b, 0);

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[clamp(20px,1.5vw,28px)]">
            <BarChart3 className="h-[clamp(18px,1.2vw,26px)] w-[clamp(18px,1.2vw,26px)] text-primary" />
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
            <p className="text-muted-foreground text-[clamp(12px,0.8vw,16px)] mt-1">
              Create one from the Play page!
            </p>
          </div>
        ) : (
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
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-[clamp(14px,1vw,28px)]">
                      <span>{option}</span>
                      <span className="text-muted-foreground">
                        {count} ({Math.round(percentage)}%)
                      </span>
                    </div>

                    <div className="h-[clamp(28px,2vw,40px)] bg-secondary rounded-md overflow-hidden relative">
                      <div
                        className="h-full bg-primary/80 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-3 text-[clamp(14px,1vw,20px)] font-medium">
                        {option}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-[clamp(14px,1vw,20px)] text-muted-foreground pt-1">
              <Users className="h-[clamp(14px,1vw,20px)] w-[clamp(14px,1vw,22px)]" />
              <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
