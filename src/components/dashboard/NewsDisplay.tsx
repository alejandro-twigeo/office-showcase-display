import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { useDailyNews, NewsItem } from "@/hooks/useDailyNews";
import { usePollRotations } from "@/contexts/pollRotation";
import { ROTATE_SECONDS } from "@/components/dashboard/PollDisplay";
import { ThisWeekCard } from "./WeekTiles";

/**
 * `standalone`: the news tile only shows news. With no news it renders nothing, so the
 * tiles around it get the space (the old layout swapped in "This week" instead).
 */
export function NewsDisplay({ standalone = false }: { standalone?: boolean }) {
  const { news, isLoading } = useDailyNews();
  const { rotations, pollTimeLeft } = usePollRotations();
  const [index, setIndex] = useState(0);

  const items: NewsItem[] = news?.items ?? [];

  // Advance news item every poll rotation
  useEffect(() => {
    if (items.length <= 1) return;
    setIndex((i) => (i + 1) % items.length);
  }, [rotations, items.length]);

  // Reset index if items change
  useEffect(() => {
    setIndex(0);
  }, [news?.run_date]);

  // Reset index if items change
  useEffect(() => {
    setIndex(0);
  }, [news?.run_date]);

  const item = items[index];

  // Every minute, swap to "This week" (offset by 30 s from the GeoGuessr/riddle swap). ?week shows it first.
  const [showWeek, setShowWeek] = useState(() => new URLSearchParams(window.location.search).has("week"));
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      setShowWeek((v) => !v);
      id = setInterval(() => setShowWeek((v) => !v), 60_000);
    }, 30_000);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, []);

  if (standalone && !isLoading && !item) return null;
  if (!standalone && !isLoading && (!item || showWeek)) return <ThisWeekCard />;

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden p-[clamp(11px,0.95vw,22px)] gap-[clamp(10px,0.9vw,18px)]">
      <div className="flex items-center justify-between gap-3">
        <span className="tile-label">Daily news</span>
        {items.length > 1 && (
          <span className="tile-label tabular-nums">
            {index + 1} / {items.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="m-auto text-muted-foreground text-[clamp(14px,1vw,20px)]">Loading…</p>
      ) : !item ? (
        <p className="m-auto text-muted-foreground text-[clamp(14px,1vw,20px)]">No news today</p>
      ) : (
        <div key={index} className="flex-1 min-h-0 flex flex-col gap-[clamp(8px,0.8vw,16px)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
          {item.audience && (
            <span className="self-start rounded-full bg-secondary px-[clamp(10px,0.7vw,14px)] py-[clamp(3px,0.25vw,5px)] font-medium text-[clamp(12px,0.8vw,16px)]">
              {item.audience}
            </span>
          )}
          <h3 className="shrink-0 font-semibold tracking-tight leading-[1.15] text-[clamp(18px,1.4vw,30px)] text-balance line-clamp-2">
            {item.headline}
          </h3>
          <p className="min-h-0 overflow-hidden text-muted-foreground leading-snug text-[clamp(13px,0.9vw,19px)] line-clamp-1">{item.summary}</p>
        </div>
      )}

      {items.length > 1 && (
        <div className="flex gap-[clamp(4px,0.3vw,6px)]">
          {items.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full bg-foreground/60 ${i === index ? "transition-[width] duration-1000 ease-linear" : ""}`}
                style={{ width: i < index ? "100%" : i === index ? `${100 - (pollTimeLeft / ROTATE_SECONDS) * 100}%` : "0%" }}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
