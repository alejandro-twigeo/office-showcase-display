import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NewsItem } from "./useDailyNews";

interface DailyNewsRow {
  id: string;
  run_date: string;
  run_datetime: string | null;
  items: NewsItem[];
}

export function useAllNews() {
  return useQuery({
    queryKey: ["all_daily_news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_news")
        .select("*")
        .order("run_date", { ascending: false });

      return (data ?? []).map((d) => ({
        ...d,
        items: d.items as unknown as NewsItem[],
      })) as DailyNewsRow[];
    },
  });
}
