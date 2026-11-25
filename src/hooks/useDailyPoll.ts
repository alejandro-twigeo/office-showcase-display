import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRounds } from "@/hooks/useRounds";

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Makes sure today's AI poll exists. Fires as soon as the daily reset creates a
 * new round, so the poll changes on the same schedule as the games, plus an
 * hourly check as a backup. The function does nothing if the poll already exists.
 */
export function useDailyPoll() {
  const { rounds } = useRounds();
  const latestRoundId = rounds.reduce<{ id: string; n: number } | null>(
    (best, r) => (!best || r.round_number > best.n ? { id: r.id, n: r.round_number } : best),
    null
  )?.id;

  useEffect(() => {
    if (import.meta.env.DEV) return;
    const run = () => {
      supabase.functions.invoke("generate-daily-poll", { body: {} }).catch(() => {
        /* not deployed yet or AI down: try again later */
      });
    };
    // Small random delay so several TVs reacting to the same reset don't race each other
    const first = setTimeout(run, 5_000 + Math.random() * 60_000);
    const id = setInterval(run, CHECK_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [latestRoundId]);
}
