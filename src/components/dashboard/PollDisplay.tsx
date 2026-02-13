import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePolls, useVotes } from "@/hooks/usePolls";
import { BarChart3, Clock, Users } from "lucide-react";

const ROTATE_SECONDS = 30;

export function PollDisplay() {
  const { activePolls } = usePolls();

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
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Live Poll
          </CardTitle>
          {currentPoll && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="font-mono">{timeLeft}s</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!currentPoll ? (
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No active polls</p>
            <p className="text-muted-foreground text-xs mt-1">
              Create one from the Play page!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-4">
              <Progress value={(timeLeft / ROTATE_SECONDS) * 100} className="h-1" />
            </div>

            <h3 className="font-semibold text-lg">{currentPoll.question}</h3>

            <div className="space-y-3">
              {(currentPoll.options as string[]).map((option, index) => {
                const count = voteCounts[index] || 0;
                const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;

                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{option}</span>
                      <span className="text-muted-foreground">
                        {count} ({Math.round(percentage)}%)
                      </span>
                    </div>

                    <div className="h-8 bg-secondary rounded-md overflow-hidden relative">
                      <div
                        className="h-full bg-primary/80 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-3 text-sm font-medium">
                        {option}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
              <Users className="h-4 w-4" />
              <span>{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
