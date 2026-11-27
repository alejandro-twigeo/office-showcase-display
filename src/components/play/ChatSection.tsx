import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChat, chatTimeLeft, chatAgo, CHAT_MAX_LEN, type ChatMessage } from "@/hooks/useChat";
import { useIsAdmin } from "@/hooks/usePlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Trash2, CornerDownRight, Loader2 } from "lucide-react";

/**
 * Office chat. Start a conversation or answer one. A conversation shows on the TV and
 * disappears 2 hours after its last message; every reply restarts that clock.
 */
export function ChatSection({ playerName }: { playerName: string }) {
  const { threads, isLoading, post, remove, now } = useChat();
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

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");

  const canDelete = (m: ChatMessage) => isAdmin || m.created_by.trim().toLowerCase() === playerName.trim().toLowerCase();

  const send = (body: string, threadId: string | null, done: () => void) => {
    if (!body.trim()) return;
    setError("");
    post.mutate(
      { body, created_by: playerName, thread_id: threadId },
      {
        onSuccess: done,
        onError: () => setError(threadId ? "That conversation just ended. Start a new one?" : "Couldn't send. Try again."),
      }
    );
  };

  const askDelete = (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      window.setTimeout(() => setConfirmDelete((c) => (c === id ? null : c)), 3000);
      return;
    }
    setConfirmDelete(null);
    remove.mutate(id);
  };

  const DeleteButton = ({ m }: { m: ChatMessage }) =>
    canDelete(m) ? (
      confirmDelete === m.id ? (
        <Button size="sm" variant="destructive" className="h-6 px-2 text-[11px]" onClick={() => askDelete(m.id)}>
          Delete?
        </Button>
      ) : (
        <button type="button" onClick={() => askDelete(m.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Delete message">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )
    ) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4 text-primary" />
          Chat
        </CardTitle>
        <p className="text-xs text-muted-foreground">Shows on the TV. A conversation disappears 2 hours after its last message.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New conversation */}
        <form
          className="space-y-2 rounded-lg border bg-muted/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft, null, () => setDraft(""));
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.slice(0, CHAT_MAX_LEN));
              setError("");
            }}
            placeholder="Say something to the office…"
            className="min-h-[60px] resize-none text-sm"
          />
          <div className="flex items-center gap-2">
            <span className="flex-1 text-xs text-muted-foreground">From {playerName}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {draft.length}/{CHAT_MAX_LEN}
            </span>
            <Button type="submit" size="sm" className="gap-1" disabled={!draft.trim() || post.isPending}>
              {post.isPending && !replyTo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        {/* Conversations */}
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Quiet right now. Start a conversation 💬</p>
        ) : (
          <div className="space-y-3">
            {threads.map((t) => (
              <div key={t.id} className="rounded-xl border p-3 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none">{av(t.created_by)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">
                      <b className="text-foreground">{t.created_by}</b> · {chatAgo(t.created_at, now)}
                    </p>
                    <p className="mt-0.5 break-words text-sm leading-snug">{t.body}</p>
                  </div>
                  <DeleteButton m={t} />
                </div>

                {t.replies.length > 0 && (
                  <div className="mt-2 space-y-2 border-l-2 border-primary/20 pl-3 ml-2.5">
                    {t.replies.map((r) => (
                      <div key={r.id} className="flex items-start gap-2 animate-in fade-in duration-300">
                        <span className="leading-none">{av(r.created_by)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            <b className="text-foreground">{r.created_by}</b> · {chatAgo(r.created_at, now)}
                          </p>
                          <p className="break-words text-sm leading-snug">{r.body}</p>
                        </div>
                        <DeleteButton m={r} />
                      </div>
                    ))}
                  </div>
                )}

                {replyTo === t.id ? (
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      send(replyDraft, t.id, () => {
                        setReplyDraft("");
                        setReplyTo(null);
                      });
                    }}
                  >
                    <Input
                      autoFocus
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value.slice(0, CHAT_MAX_LEN))}
                      placeholder={`Reply to ${t.created_by}…`}
                      className="h-9 text-sm"
                    />
                    <Button type="submit" size="sm" className="h-9 shrink-0" disabled={!replyDraft.trim() || post.isPending} aria-label="Send reply">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                ) : (
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(t.id);
                        setReplyDraft("");
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-primary"
                    >
                      <CornerDownRight className="h-3.5 w-3.5" /> Reply
                    </button>
                    <span className="text-[11px] text-muted-foreground/80">disappears in {chatTimeLeft(t.endsAt, now)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
