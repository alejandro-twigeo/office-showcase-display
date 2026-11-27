import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** A conversation disappears this long after its last message */
export const CHAT_TTL_MS = 2 * 60 * 60 * 1000;
export const CHAT_MAX_LEN = 140;

export interface ChatMessage {
  id: string;
  thread_id: string | null;
  body: string;
  created_by: string;
  created_at: string;
  last_activity_at: string;
}

export interface ChatThread extends ChatMessage {
  replies: ChatMessage[];
  /** When it disappears (2 hours after the last message) */
  endsAt: number;
}

// The chat table isn't in the generated types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chatTable = () => (supabase as any).from("chat_messages");

/**
 * Office chat: conversations that stay while people keep answering.
 * Each conversation disappears 2 hours after its last message (the database clears them too).
 */
export function useChat() {
  const queryClient = useQueryClient();
  // Each screen gets its own live connection name, so the TV tile and the phone page never clash
  const channelName = `chat-${useId()}`;

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - CHAT_TTL_MS - 5 * 60_000).toISOString();
      const { data, error } = await chatTable()
        .select("*")
        .gte("last_activity_at", since)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, queryClient]);

  // Re-check every 30 s so conversations vanish on time
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  /** Live conversations, the most recently active first, with their replies in order */
  const threads = useMemo<ChatThread[]>(() => {
    const roots = messages.filter((m) => !m.thread_id);
    const repliesByThread = new Map<string, ChatMessage[]>();
    for (const m of messages) {
      if (!m.thread_id) continue;
      const list = repliesByThread.get(m.thread_id) ?? [];
      list.push(m);
      repliesByThread.set(m.thread_id, list);
    }
    return roots
      .map((r) => {
        const replies = repliesByThread.get(r.id) ?? [];
        const last = Math.max(Date.parse(r.last_activity_at), ...replies.map((x) => Date.parse(x.created_at)));
        return { ...r, replies, endsAt: last + CHAT_TTL_MS };
      })
      .filter((t) => t.endsAt > now)
      .sort((a, b) => b.endsAt - a.endsAt);
  }, [messages, now]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["chat-messages"] });

  const post = useMutation({
    mutationFn: async (data: { body: string; created_by: string; thread_id?: string | null }) => {
      const { error } = await chatTable().insert({
        body: data.body.trim().slice(0, CHAT_MAX_LEN),
        created_by: data.created_by,
        thread_id: data.thread_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await chatTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { threads, isLoading, post, remove, now };
}

/** "1 h 20 min", "35 min", "under a minute" */
export function chatTimeLeft(endsAt: number, now = Date.now()) {
  const min = Math.max(0, Math.round((endsAt - now) / 60_000));
  if (min < 1) return "under a minute";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function chatAgo(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h`;
}
