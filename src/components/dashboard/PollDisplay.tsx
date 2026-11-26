import { useEffect, useMemo, useRef, useState } from "react";
import { usePollRotations } from "@/contexts/pollRotation";
import { Card } from "@/components/ui/card";
import { usePolls, useVotes } from "@/hooks/usePolls";
import { CountUp } from "@/components/ui/count-up";

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
            <div className="mt-auto min-h-0 flex flex-col gap-[clamp(5px,0.45vw,10px)] overflow-hidden">
              {rows.map(({ key, label, count }) => {
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const leading = count > 0 && count === topCount;
                return (
                  <div key={key} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`truncate text-[clamp(13px,0.95vw,20px)] ${leading ? "font-semibold" : "font-medium"}`}>
                        {label}
                      </span>
                      <span className={`shrink-0 tabular-nums text-[clamp(13px,0.95vw,20px)] ${leading ? "font-semibold" : "text-muted-foreground"}`}>
                        <CountUp value={pct} />%
                      </span>
                    </div>
                    <div className="mt-[clamp(4px,0.3vw,6px)] h-[clamp(5px,0.4vw,9px)] rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-[width] duration-700 ease-out ${leading ? "bg-primary" : "bg-foreground/35"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
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
