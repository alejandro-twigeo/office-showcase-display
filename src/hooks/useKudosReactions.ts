import { useEffect, useId, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const REACTION_EMOJIS = ["👏", "❤️", "😂", "🎉", "🙌", "🔥"] as const;

interface Reaction {
  id: string;
  kudos_id: string;
  emoji: string;
  player_name: string;
}

// The reactions table isn't in the generated types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("kudos_reactions");

/** Reactions on kudos, live. `toggle` adds your reaction, or takes it back if you already gave that one. */
export function useKudosReactions(me: string | null) {
  const queryClient = useQueryClient();
  const channelName = `kudos-reactions-${useId()}`;

  const { data: reactions = [] } = useQuery<Reaction[]>({
    queryKey: ["kudos-reactions"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await table().select("id, kudos_id, emoji, player_name").order("created_at", { ascending: true }).limit(2000);
      if (error) return []; // before the database step has run
      return (data ?? []) as Reaction[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "kudos_reactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kudos-reactions"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, queryClient]);

  /** For one kudos: each emoji used, how many, who, and whether you did */
  const forKudos = useMemo(() => {
    const map = new Map<string, { emoji: string; count: number; names: string[]; mine: boolean }[]>();
    for (const r of reactions) {
      const list = map.get(r.kudos_id) ?? [];
      let item = list.find((x) => x.emoji === r.emoji);
      if (!item) {
        item = { emoji: r.emoji, count: 0, names: [], mine: false };
        list.push(item);
      }
      item.count++;
      item.names.push(r.player_name);
      if (me && r.player_name === me) item.mine = true;
      map.set(r.kudos_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => REACTION_EMOJIS.indexOf(a.emoji as never) - REACTION_EMOJIS.indexOf(b.emoji as never));
    return (id: string) => map.get(id) ?? [];
  }, [reactions, me]);

  const toggle = useMutation({
    mutationFn: async ({ kudosId, emoji }: { kudosId: string; emoji: string }) => {
      if (!me) throw new Error("not logged in");
      const mine = reactions.find((r) => r.kudos_id === kudosId && r.emoji === emoji && r.player_name === me);
      const { error } = mine
        ? await table().delete().eq("id", mine.id)
        : await table().insert({ kudos_id: kudosId, emoji, player_name: me });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kudos-reactions"] }),
  });

  return { forKudos, toggle };
}
