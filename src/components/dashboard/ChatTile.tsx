import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMe, ACTIONABLE } from "@/hooks/useMe";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { chatAgo, CHAT_MAX_LEN, type ChatMessage } from "@/hooks/useChat";

/**
 * The office chat on the TV: like a chat app, newest at the bottom. When there are more
 * messages than fit, the oldest fade out at the top (phones can scroll up for them).
 */
export function ChatTile({ messages, now, onSend }: { messages: ChatMessage[]; now: number; onSend?: (body: string, me: string) => void }) {
  // On a laptop: click the tile to write (or log in first)
  const navigate = useNavigate();
  const me = useMe();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const open = () => (me ? setComposing(true) : navigate("/play?tab=chat"));
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
    <Card onClick={open} className={`h-full min-h-0 flex flex-col overflow-hidden p-[clamp(14px,1.3vw,28px)] gap-[clamp(8px,0.7vw,14px)] ${composing ? "" : ACTIONABLE}`}>
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
      {composing && me && (
        <form
          className="flex shrink-0 gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onSend?.(draft, me);
            setDraft("");
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_LEN))}
            onKeyDown={(e) => e.key === "Escape" && setComposing(false)}
            placeholder={`Message as ${me}…`}
            className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-[clamp(13px,0.95vw,19px)] outline-none focus:border-primary"
          />
          <button type="submit" disabled={!draft.trim()} className="shrink-0 rounded-lg bg-primary px-3 text-[clamp(13px,0.95vw,19px)] font-semibold text-primary-foreground disabled:opacity-40">
            Send
          </button>
        </form>
      )}
    </Card>
  );
}
