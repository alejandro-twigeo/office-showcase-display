import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NewsItem {
  audience: string;
  headline: string;
  summary: string;
  date: string;
  url: string;
}

interface DailyNews {
  id: string;
  run_date: string;
  run_datetime: string | null;
  items: NewsItem[];
}

export function useDailyNews() {
  const [news, setNews] = useState<DailyNews | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch_ = async () => {
    const { data } = await supabase
      .from("daily_news")
      .select("*")
      .order("run_date", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setNews({
        ...data,
        items: (data.items as any) as NewsItem[],
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetch_();

    const channel = supabase
      .channel("daily_news_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_news" },
        () => fetch_()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { news, isLoading };
}
