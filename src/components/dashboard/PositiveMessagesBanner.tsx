import { useEffect, useState } from "react";
import { usePositiveMessages } from "@/hooks/usePositiveMessages";
import { usePollRotations } from "@/contexts/pollRotation";
import { ROTATE_SECONDS } from "@/components/dashboard/PollDisplay";

const DEFAULT_MSG = "Add your first positive message ✨";
const INTERVAL = 60;

export function PositiveMessagesBanner() {
  const { messages } = usePositiveMessages();

  // no plants handled here any more

  const [index, setIndex] = useState(0);
  const { rotations, pollTimeLeft } = usePollRotations();

  // Reset index when messages change
  useEffect(() => {
    setIndex(0);
  }, [messages.length]);

  // advance every 2 poll rotations
  useEffect(() => {
    if (rotations > 0 && rotations % 2 === 0) {
      if (messages.length > 1) {
        setIndex((i) => (i + 1) % messages.length);
      }
    }
  }, [rotations, messages.length]);

  const current = messages.length > 0 ? messages[index] : null;
  const displayMsg = current?.message ?? DEFAULT_MSG;
  const displayBy = current?.created_by;

  // countdown computed from poll context
  const totalElapsed = (rotations % 2 === 1 ? ROTATE_SECONDS : 0) +
    (ROTATE_SECONDS - pollTimeLeft);
  const countdown = ROTATE_SECONDS * 2 - totalElapsed;

  // no plant code here anymore; banner only shows rotating message/timer

  return (
    <div className="overflow-hidden">
      <div className="px-[clamp(20px,1.8vw,40px)] py-[clamp(12px,1vw,24px)] flex flex-col items-center gap-1">
        <div className="flex items-center gap-[clamp(10px,0.8vw,18px)]">
          <p className="text-[clamp(16px,1.4vw,30px)] font-medium leading-snug truncate">
            {displayMsg}{displayBy && <span className="text-muted-foreground font-normal ml-2">— {displayBy}</span>}
          </p>
        </div>

        {messages.length > 1 && (
          <span className="text-[clamp(12px,0.85vw,18px)] text-muted-foreground tabular-nums">
            {countdown}s · {index + 1}/{messages.length}
          </span>
        )}
      </div>
    </div>
  );
}
