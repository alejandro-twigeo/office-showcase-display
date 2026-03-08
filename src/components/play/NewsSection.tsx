import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useAllNews } from "@/hooks/useAllNews";

export function NewsSection() {
  const { data: allDays = [], isLoading } = useAllNews();
  const [dayIdx, setDayIdx] = useState(0);
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null);

  const currentDay = allDays[dayIdx] ?? null;
  const items = currentDay?.items ?? [];

  const canPrev = dayIdx < allDays.length - 1;
  const canNext = dayIdx > 0;

  const audiences = useMemo(() => {
    const set = new Set(items.map((i) => i.audience));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(
    () => (selectedAudience ? items.filter((i) => i.audience === selectedAudience) : items),
    [items, selectedAudience]
  );

  // Reset audience filter when changing day
  const goDay = (idx: number) => {
    setDayIdx(idx);
    setSelectedAudience(null);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="space-y-4">
      {/* Header with day navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          Daily News
        </h2>

        {allDays.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => goDay(dayIdx + 1)}
              disabled={!canPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground min-w-[120px] text-center">
              {currentDay ? formatDate(currentDay.run_date) : "—"}
              {dayIdx === 0 && " (latest)"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => goDay(dayIdx - 1)}
              disabled={!canNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Audience filter chips */}
      {audiences.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedAudience(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              !selectedAudience
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            All ({items.length})
          </button>
          {audiences.map((a) => {
            const count = items.filter((i) => i.audience === a).length;
            return (
              <button
                key={a}
                onClick={() => setSelectedAudience(selectedAudience === a ? null : a)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedAudience === a
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {a} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* News list */}
      {isLoading ? (
        <div className="text-center py-8">
          <Newspaper className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Loading news…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <Newspaper className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {items.length === 0 ? "No news for this day" : "No news for this audience"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, idx) => (
            <Card key={idx} className="flex flex-col">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {item.audience}
                  </Badge>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 px-4 pb-4">
                <h3 className="font-semibold text-sm leading-tight mb-1.5">
                  {item.headline}
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {item.summary}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
