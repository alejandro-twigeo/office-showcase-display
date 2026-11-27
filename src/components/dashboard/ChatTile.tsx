import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { chatAgo, type ChatMessage } from "@/hooks/useChat";

/**
 * The office chat on the TV: like a chat app, newest at the bottom. When there are more
 * messages than fit, the oldest fade out at the top (phones can scroll up for them).
 */
export function ChatTile({ messages, now }: { messages: ChatMessage[]; now: number }) {
  const { data: players = [] } = useQuery({
    queryKey: ["players-avatars"],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("name, avatar");
      return data ?? [];
    },
  });
  const avatars = useMemo(() => new Map(players.map((p) => [p.name, p.avatar as string | null])), [players]);
  const av = (n: string) => avatars.get(n) ?? "👤";
  const shown = messages.slice(-12);

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden p-[clamp(14px,1.3vw,28px)] gap-[clamp(8px,0.7vw,14px)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="tile-label">💬 Chat</span>
        <span className="tile-label">Write on the Play page</span>
      </div>
      {/* Anchored to the bottom: the newest message is always in view */}
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-[clamp(6px,0.55vw,11px)] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_22%)]">
        {shown.map((m, i) => {
          const sameAsPrev = i > 0 && shown[i - 1].created_by === m.created_by;
          return (
            <p key={m.id} className="flex shrink-0 items-baseline gap-[0.45em] text-[clamp(13px,1vw,21px)] leading-snug animate-in fade-in slide-in-from-bottom-1 duration-500">
              <span className={`w-[1.3em] shrink-0 text-center leading-none ${sameAsPrev ? "invisible" : ""}`}>{av(m.created_by)}</span>
              <span className="min-w-0 break-words">
                {!sameAsPrev && <b className="font-semibold">{m.created_by} </b>}
                {m.body}
                {i === shown.length - 1 && <span className="text-muted-foreground text-[0.8em]"> · {chatAgo(m.created_at, now)}</span>}
              </span>
            </p>
          );
        })}
      </div>
    </Card>
  );
}
