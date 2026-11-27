import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NewsTopic {
  headline: string;
  url: string;
  /** The site it's from, for a short "via theverge.com" */
  source: string;
}

const EVERY_MS = 90_000;

/**
 * Today's news as a chat topic: one headline at a time, moving on every 90 seconds, the same one
 * on every screen at the same moment (it follows the clock). The news section itself is gone;
 * this is where the daily news lives now, as something to talk about. Null when there's no news.
 */
export function useNewsTopic(): NewsTopic | null {
  const { data: items = [] } = useQuery({
    queryKey: ["chat-news-topics"],
    staleTime: 15 * 60_000,
    refetchInterval: 30 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("daily_news").select("items").order("run_date", { ascending: false }).limit(1).maybeSingle();
      const list = Array.isArray(data?.items) ? (data.items as { headline?: string; url?: string }[]) : [];
      return list
        .filter((i) => i.headline && i.url)
        .map((i) => {
          let source = "";
          try {
            source = new URL(i.url!).hostname.replace(/^www\./, "");
          } catch {
            /* not a full link */
          }
          return { headline: i.headline!.trim(), url: i.url!, source };
        });
    },
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  if (!items.length) return null;
  return items[Math.floor(now / EVERY_MS) % items.length];
}
