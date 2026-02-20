import { useEffect, useRef, useState } from "react";
import { usePositiveMessages } from "@/hooks/usePositiveMessages";
import { Heart } from "lucide-react";

const DEFAULT_MSG = "Add your first positive message ✨";
const INTERVAL = 60;

export function PositiveMessagesBanner() {
  const { messages } = usePositiveMessages();
  const [index, setIndex] = useState(0);
  const [countdown, setCountdown] = useState(INTERVAL);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset index when messages change
  useEffect(() => {
    setIndex(0);
    setCountdown(INTERVAL);
  }, [messages.length]);

  // Countdown + auto-advance
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (messages.length > 1) {
            setIndex((i) => (i + 1) % messages.length);
          }
          return INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [messages.length]);

  const current = messages.length > 0 ? messages[index] : null;
  const displayMsg = current?.message ?? DEFAULT_MSG;
  const displayBy = current?.created_by;

  // Progress bar width (shrinks from 100% to 0%)
  const progress = (countdown / INTERVAL) * 100;

  return (
    <div className="relative rounded-xl border border-primary/30 bg-card overflow-hidden">
      {/* Orange accent left bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />

      {/* Progress bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted">
        <div
          className="h-full bg-primary transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="px-[clamp(20px,1.8vw,40px)] py-[clamp(12px,1vw,24px)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-[clamp(10px,0.8vw,18px)] flex-1 min-w-0">
          <Heart className="h-[clamp(16px,1.2vw,28px)] w-[clamp(16px,1.2vw,28px)] text-primary shrink-0 fill-primary" />
          <div className="flex flex-col min-w-0">
            <p className="text-[clamp(16px,1.4vw,30px)] font-medium leading-snug">
              {displayMsg}
            </p>
            {displayBy && (
              <p className="text-[clamp(12px,0.85vw,18px)] text-muted-foreground mt-0.5">
                — {displayBy}
              </p>
            )}
          </div>
        </div>

        {messages.length > 1 && (
          <div className="shrink-0 flex items-center gap-[clamp(6px,0.5vw,12px)]">
            <span className="text-[clamp(12px,0.85vw,18px)] text-muted-foreground tabular-nums">
              {countdown}s
            </span>
            <div className="flex gap-1">
              {messages.slice(0, 5).map((_, i) => (
                <span
                  key={i}
                  className={`block rounded-full transition-all ${
                    i === index % Math.min(messages.length, 5)
                      ? "bg-primary w-[clamp(12px,0.7vw,18px)] h-[clamp(4px,0.3vw,6px)]"
                      : "bg-muted w-[clamp(4px,0.3vw,6px)] h-[clamp(4px,0.3vw,6px)]"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
