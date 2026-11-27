import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { chatAgo, chatTimeLeft, type ChatThread } from "@/hooks/useChat";

/** The office chat on the TV: live conversations, most recently active first, replies underneath. */
export function ChatTile({ threads, now }: { threads: ChatThread[]; now: number }) {
  const { data: players = [] } = useQuery({
    queryKey: ["players-avatars"],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("name, avatar");
      return data ?? [];
    },
  });
  const avatars = useMemo(() => new Map(players.map((p) => [p.name, p.avatar as string | null])), [players]);
  const av = (n: string) => avatars.get(n) ?? "👤";

  return (
    <Card className="h-full min-h-0 flex flex-col overflow-hidden p-[clamp(14px,1.3vw,28px)] gap-[clamp(8px,0.7vw,14px)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="tile-label">💬 Chat</span>
        <span className="tile-label">Write on the Play page</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[clamp(10px,0.9vw,18px)] overflow-hidden [mask-image:linear-gradient(to_bottom,black_85%,transparent)]">
        {threads.slice(0, 4).map((t) => (
          <div key={t.id} className="space-y-[clamp(3px,0.3vw,6px)] animate-in fade-in slide-in-from-bottom-1 duration-500">
            <p className="flex items-baseline gap-[0.4em] text-[clamp(14px,1.05vw,22px)] leading-snug">
              <span className="shrink-0 leading-none">{av(t.created_by)}</span>
              <span className="min-w-0 break-words">
                <b className="font-semibold">{t.created_by}</b> {t.body}
              </span>
            </p>
            {t.replies.slice(-2).map((r) => (
              <p key={r.id} className="ml-[1.6em] flex items-baseline gap-[0.4em] text-[clamp(12px,0.9vw,19px)] leading-snug text-foreground/85">
                <span className="shrink-0 leading-none">{av(r.created_by)}</span>
                <span className="min-w-0 break-words">
                  <b className="font-semibold">{r.created_by}</b> {r.body}
                  <span className="text-muted-foreground"> · {chatAgo(r.created_at, now)}</span>
                </span>
              </p>
            ))}
            {t.replies.length > 2 && (
              <p className="ml-[1.6em] text-muted-foreground text-[clamp(11px,0.8vw,16px)]">+{t.replies.length - 2} earlier replies</p>
            )}
            <p className="ml-[1.6em] text-muted-foreground/80 text-[clamp(10px,0.75vw,15px)]">disappears in {chatTimeLeft(t.endsAt, now)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
