import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlayerAvatar } from "@/components/PlayerAvatar";

/**
 * A small row of people's characters, slightly overlapping (like the faces on a shared doc):
 * who voted, who solved it. Shows up to `max`, then "+N". Sizes follow the text around it.
 */
export function AvatarStack({ names, max = 5, size = "1.45em", className = "" }: { names: string[]; max?: number; size?: string; className?: string }) {
  const { data: players = [] } = useQuery({
    queryKey: ["players-avatars"],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("name, avatar");
      return data ?? [];
    },
  });
  const avatars = useMemo(() => new Map(players.map((p) => [p.name, p.avatar as string | null])), [players]);
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length === 0) return null;
  const shown = unique.slice(0, max);
  const more = unique.length - shown.length;

  return (
    <span className={`inline-flex items-center ${className}`} title={unique.join(", ")}>
      {shown.map((n, i) => (
        <span
          key={n}
          className="relative -ml-[0.42em] first:ml-0 animate-in fade-in zoom-in-75 duration-300"
          style={{ zIndex: shown.length - i }}
        >
          <PlayerAvatar avatar={avatars.get(n)} name={n} size={size} still />
        </span>
      ))}
      {more > 0 && <span className="ml-[0.2em] text-[0.85em] font-medium tabular-nums text-muted-foreground">+{more}</span>}
    </span>
  );
}
