import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The logged-in person's name on this screen, or null (the office TV is never logged in).
 * The TV page uses it to make tiles clickable on a laptop: vote, chat, react.
 */
export function useMe() {
  const queryClient = useQueryClient();
  const { data: me = null } = useQuery<string | null>({
    queryKey: ["me"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: name } = await (supabase as any).rpc("my_player_name");
      return (name as string | null) ?? null;
    },
  });
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") queryClient.invalidateQueries({ queryKey: ["me"] });
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);
  return me;
}

/** Tailwind classes: a soft highlight on hover, only on screens with a mouse (never on the TV or phones) */
export const ACTIONABLE =
  "cursor-pointer transition-shadow [@media(hover:hover)]:hover:shadow-[0_0_0_2px_hsl(var(--primary)/0.35)]";
