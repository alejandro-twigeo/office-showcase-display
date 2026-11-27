import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChat, chatAgo, CHAT_MAX_LEN, type ChatMessage } from "@/hooks/useChat";
import { useIsAdmin } from "@/hooks/usePlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Trash2, Loader2 } from "lucide-react";

/**
 * Office chat: one shared conversation, also on the TV. Newest at the bottom, scroll up for
 * the rest. Every message keeps the chat alive; it clears after 2 hours without messages.
 */
export function ChatSection({ playerName }: { playerName: string }) {
  const { messages, isLoading, post, remove, now } = useChat();
  const { data: isAdmin = false } = useIsAdmin();
  const { data: players = [] } = useQuery({
    queryKey: ["players-avatars"],
    queryFn: async () => {
      const { data } = await supabase.from("players").select("name, avatar");
      return data ?? [];
    },
  });
  const avatars = useMemo(() => new Map(players.map((p) => [p.name, p.avatar as string | null])), [players]);
  const av = (n: string) => avatars.get(n) ?? "👤";
  const isMe = (n: string) => n.trim().toLowerCase() === playerName.trim().toLowerCase();

  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Keep the newest message in view
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setError("");
    post.mutate({ body: draft, created_by: playerName }, { onSuccess: () => setDraft(""), onError: () => setError("Couldn't send. Try again.") });
  };

  const askDelete = (m: ChatMessage) => {
    if (confirmDelete !== m.id) {
      setConfirmDelete(m.id);
      window.setTimeout(() => setConfirmDelete((c) => (c === m.id ? null : c)), 3000);
      return;
    }
    setConfirmDelete(null);
    remove.mutate(m.id);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4 text-primary" />
          Chat
        </CardTitle>
        <p className="text-xs text-muted-foreground">Everyone at the office, and on the TV. It clears after 2 hours without messages.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={listRef} className="max-h-[55vh] min-h-[160px] space-y-2 overflow-y-auto overscroll-contain rounded-lg border bg-muted/20 p-3">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Quiet right now. Say hi 👋</p>
          ) : (
            messages.map((m, i) => {
              const mine = isMe(m.created_by);
              // Messages from the same person in a row share one name line
              const sameAsPrev = i > 0 && messages[i - 1].created_by === m.created_by;
              return (
                <div key={m.id} className={`flex items-end gap-2 animate-in fade-in duration-300 ${mine ? "flex-row-reverse" : ""}`}>
                  <span className={`w-6 shrink-0 text-center text-lg leading-none ${sameAsPrev ? "invisible" : ""}`}>{av(m.created_by)}</span>
                  <div className={`max-w-[78%] min-w-0 ${mine ? "items-end text-right" : ""} flex flex-col`}>
                    {!sameAsPrev && (
                      <span className="mb-0.5 text-[11px] text-muted-foreground">
                        {mine ? "You" : m.created_by} · {chatAgo(m.created_at, now)}
                      </span>
                    )}
                    <div className="group flex items-center gap-1">
                      {mine && (
                        <DeleteButton confirming={confirmDelete === m.id} onClick={() => askDelete(m)} />
                      )}
                      <p
                        className={`break-words rounded-2xl px-3 py-1.5 text-left text-sm leading-snug ${
                          mine ? "bg-primary text-primary-foreground" : "bg-card border"
                        }`}
                      >
                        {m.body}
                      </p>
                      {isAdmin && !mine && <DeleteButton confirming={confirmDelete === m.id} onClick={() => askDelete(m)} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={send} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.slice(0, CHAT_MAX_LEN));
              setError("");
            }}
            placeholder="Say something to the office…"
            className="h-10 text-sm"
            enterKeyHint="send"
          />
          <Button type="submit" className="h-10 shrink-0 gap-1" disabled={!draft.trim() || post.isPending} aria-label="Send">
            {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function DeleteButton({ confirming, onClick }: { confirming: boolean; onClick: () => void }) {
  return confirming ? (
    <Button size="sm" variant="destructive" className="h-6 shrink-0 px-2 text-[11px]" onClick={onClick}>
      Delete?
    </Button>
  ) : (
    <button type="button" onClick={onClick} className="shrink-0 p-1 text-muted-foreground/60 hover:text-destructive" aria-label="Delete message">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
