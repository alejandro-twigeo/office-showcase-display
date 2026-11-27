import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMe, ACTIONABLE } from "@/hooks/useMe";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { chatAgo, CHAT_MAX_LEN, type ChatMessage } from "@/hooks/useChat";
import { MentionText } from "@/components/MentionText";
import { starterAt } from "@/lib/chatStarters";

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
  const playerNames = useMemo(() => [...avatars.keys()], [avatars]);
  const av = (n: string) => avatars.get(n) ?? "👤";
  const shown = messages.slice(-12);

  return (
    <Card onClick={open} className={`h-full min-h-0 flex flex-col overflow-hidden p-[clamp(14px,1.3vw,28px)] gap-[clamp(8px,0.7vw,14px)] ${composing ? "" : ACTIONABLE}`}>
      <span className="tile-label">💬 Chat</span>
      {/* Anchored to the bottom: the newest message is always in view */}
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-[clamp(4px,0.35vw,7px)] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_18%)]">
        {/* A quiet chat gets a nudge: a conversation starter that changes every half minute */}
        {shown.length < 4 && (
          <p key={starterAt(now)} className="mb-[clamp(4px,0.4vw,8px)] self-start rounded-2xl border border-dashed border-primary/40 px-[0.9em] py-[0.45em] text-muted-foreground text-[clamp(12px,0.9vw,19px)] animate-in fade-in duration-700">
            💡 {starterAt(now)}
          </p>
        )}
        {shown.map((m, i) => {
          // Messages in a row from the same person share one name line, under the last one
          const lastOfRun = i === shown.length - 1 || shown[i + 1].created_by !== m.created_by;
          return (
            <div key={m.id} className={`flex shrink-0 flex-col items-start animate-in fade-in slide-in-from-bottom-1 duration-500 ${lastOfRun ? "mb-[clamp(4px,0.35vw,7px)]" : ""}`}>
              <p
                className={`max-w-[92%] break-words bg-[hsl(var(--card))] px-[0.85em] py-[0.4em] leading-snug text-[clamp(13px,1vw,21px)] shadow-[0_1px_0_hsl(var(--foreground)/0.06)] ${
                  lastOfRun ? "rounded-[1.1em] rounded-bl-[0.3em]" : "rounded-[1.1em]"
                }`}
              >
                <MentionText text={m.body} playerNames={playerNames} avatars={avatars} />
              </p>
              {lastOfRun && (
                <span className="mt-[0.25em] pl-[0.5em] text-muted-foreground text-[clamp(10px,0.72vw,15px)]">
                  {av(m.created_by)} <span className="font-medium text-foreground/75">{m.created_by}</span> · {chatAgo(m.created_at, now)}
                </span>
              )}
            </div>
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
