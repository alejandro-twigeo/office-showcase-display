import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Newspaper, ExternalLink } from "lucide-react";
import { useDailyNews, NewsItem } from "@/hooks/useDailyNews";
import { usePollRotations } from "@/contexts/pollRotation";
import { ROTATE_SECONDS } from "@/components/dashboard/PollDisplay";

export function NewsDisplay() {
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

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden">
      <CardHeader className="pb-1 pt-3 px-3 md:pb-2 md:pt-6 md:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5 text-sm md:text-[clamp(20px,1.5vw,28px)]">
            <Newspaper className="h-4 w-4 md:h-[clamp(18px,1.2vw,26px)] md:w-[clamp(18px,1.2vw,26px)] text-primary" />
            Daily News
          </CardTitle>
          {items.length > 1 && (
            <span className="text-[clamp(12px,0.8vw,16px)] text-muted-foreground tabular-nums">
              {index + 1}/{items.length}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="text-center flex flex-col items-center justify-center h-full">
            <Newspaper className="h-[clamp(32px,3vw,64px)] w-[clamp(32px,3vw,64px)] text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-[clamp(14px,1vw,20px)]">Loading news…</p>
          </div>
        ) : !item ? (
          <div className="text-center flex flex-col items-center justify-center h-full">
            <Newspaper className="h-[clamp(32px,3vw,64px)] w-[clamp(32px,3vw,64px)] text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-[clamp(14px,1vw,20px)]">No news today</p>
          </div>
        ) : (
          <div className="space-y-[clamp(8px,0.8vw,16px)]">
            {items.length > 1 && (
              <Progress value={(pollTimeLeft / ROTATE_SECONDS) * 100} className="h-[clamp(3px,0.2vw,6px)]" />
            )}
            <div className="flex items-start gap-2">
              <Badge variant="secondary" className="shrink-0 text-[clamp(10px,0.7vw,14px)]">
                {item.audience}
              </Badge>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto shrink-0 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-[clamp(14px,1vw,20px)] w-[clamp(14px,1vw,20px)]" />
                </a>
              )}
            </div>
            <h3 className="font-semibold text-[clamp(16px,1.3vw,26px)] leading-tight">
              {item.headline}
            </h3>
            <p className="text-muted-foreground text-[clamp(13px,0.95vw,19px)] leading-relaxed">
              {item.summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
