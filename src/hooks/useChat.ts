import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** The chat clears when nobody has written for this long */
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

// The chat table isn't in the generated types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chatTable = () => (supabase as any).from("chat_messages");

/**
 * Office chat: one shared conversation, oldest message first. Every new message keeps the
 * whole chat alive; when nobody has written for 2 hours it clears (the database does too).
 */
export function useChat() {
  const queryClient = useQueryClient();
  // Each screen gets its own live connection name, so the TV tile and the phone page never clash
  const channelName = `chat-${useId()}`;

  const { data: all = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages"],
    refetchInterval: 60_000,
    queryFn: async () => {
      // The newest 300, put back in order (oldest first)
      const { data, error } = await chatTable().select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return ((data ?? []) as ChatMessage[]).reverse();
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

  // Re-check every 30 s so a quiet chat clears on time
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  /** The live chat: the messages since the last 2-hour silence, oldest first. Empty once it has gone quiet. */
  const messages = useMemo<ChatMessage[]>(() => {
    if (!all.length) return [];
    const times = all.map((m) => Date.parse(m.created_at));
    if (now - times[times.length - 1] >= CHAT_TTL_MS) return [];
    let start = all.length - 1;
    while (start > 0 && times[start] - times[start - 1] < CHAT_TTL_MS) start--;
    return all.slice(start);
  }, [all, now]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["chat-messages"] });

  const post = useMutation({
    mutationFn: async (data: { body: string; created_by: string }) => {
      const { error } = await chatTable().insert({
        body: data.body.trim().slice(0, CHAT_MAX_LEN),
        created_by: data.created_by,
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

  return { messages, isLoading, post, remove, now };
}

export function chatAgo(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "now";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h`;
}

const TYPING_SHOW_MS = 4_000; // how long the dots stay after the last keystroke
const TYPING_SEND_EVERY_MS = 1_500;

/**
 * Who is writing in the chat right now. Nothing is stored: each screen that's typing sends a
 * small live signal (at most every 1.5 s), and the others show the dots for 4 s after the last one.
 * Use it once per page: `notify()` on every keystroke, `stop()` when the message is sent.
 */
export function useChatTyping(me: string | null) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);
  const [until, setUntil] = useState<Record<string, number>>({});

  useEffect(() => {
    const channel = supabase.channel("chat-typing", { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const name = payload?.name as string | undefined;
        if (!name) return;
        setUntil((u) => ({ ...u, [name]: payload?.stop ? 0 : Date.now() + TYPING_SHOW_MS }));
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  // Drop people whose dots have run out
  const [now, setNow] = useState(() => Date.now());
  const anyone = Object.values(until).some((t) => t > now);
  useEffect(() => {
    if (!anyone) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [anyone]);

  const notify = useCallback(() => {
    if (!me || Date.now() - lastSent.current < TYPING_SEND_EVERY_MS) return;
    lastSent.current = Date.now();
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { name: me } });
  }, [me]);
  const stop = useCallback(() => {
    if (!me) return;
    lastSent.current = 0;
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { name: me, stop: true } });
  }, [me]);

  const typing = Object.entries(until)
    .filter(([n, t]) => t > Date.now() && n !== me)
    .map(([n]) => n);
  return { typing, notify, stop };
}
