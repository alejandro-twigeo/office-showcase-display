import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, ExternalLink } from "lucide-react";
import { useDailyNews, NewsItem } from "@/hooks/useDailyNews";

export function NewsSection() {
  const { news, isLoading } = useDailyNews();
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null);

  const items: NewsItem[] = news?.items ?? [];

  const audiences = useMemo(() => {
    const set = new Set(items.map((i) => i.audience));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(
    () => (selectedAudience ? items.filter((i) => i.audience === selectedAudience) : items),
    [items, selectedAudience]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          Daily News
        </h2>
        {news?.run_date && (
          <span className="text-sm text-muted-foreground">
            · {new Date(news.run_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </span>
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
            {items.length === 0 ? "No news today" : "No news for this audience"}
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
