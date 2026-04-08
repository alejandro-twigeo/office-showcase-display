import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PresenceMeta = {
  deviceId?: string;
  playerName?: string;
  page?: "play" | "tv" | "manager";
  ts?: number;
};

type PresenceState = Record<string, Array<PresenceMeta>>;

function usePresenceKey(deviceId?: string) {
  return useMemo(() => {
    const base = deviceId ?? crypto.randomUUID();
    return `${base}-${Math.random().toString(16).slice(2)}`;
  }, [deviceId]);
}

export function usePresenceTrack(room: string, meta?: PresenceMeta) {
  const presenceKey = usePresenceKey(meta?.deviceId);

  useEffect(() => {
    const channel = supabase.channel(`presence:${room}`, {
      config: { presence: { key: presenceKey } },
    });

    const trackPresence = () =>
      channel.track({
        deviceId: meta?.deviceId,
        playerName: meta?.playerName,
        page: meta?.page,
        ts: Date.now(),
      });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        trackPresence();
      }
    });

    const ping = window.setInterval(trackPresence, 30_000);

    return () => {
      window.clearInterval(ping);
      supabase.removeChannel(channel);
    };
  }, [room, presenceKey, meta?.deviceId, meta?.page, meta?.playerName]);
}

export function usePresenceCount(
  room: string,
  meta?: PresenceMeta,
  options?: { excludeSelf?: boolean }
) {
  const [count, setCount] = useState(0);
  const presenceKey = usePresenceKey(meta?.deviceId);

  useEffect(() => {
    const channel = supabase.channel(`presence:${room}`, {
      config: { presence: { key: presenceKey } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as PresenceState;
      const uniqueUsers = new Set<string>();

      for (const [key, entries] of Object.entries(state)) {
        if (options?.excludeSelf && key === presenceKey) continue;

        for (const entry of entries) {
          uniqueUsers.add(entry.deviceId ?? key);
        }
      }

      setCount(uniqueUsers.size);
    });

    const trackPresence = () =>
      channel.track({
        deviceId: meta?.deviceId,
        playerName: meta?.playerName,
        page: meta?.page,
        ts: Date.now(),
      });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        trackPresence();
      }
    });

    const ping = window.setInterval(trackPresence, 30_000);

    return () => {
      window.clearInterval(ping);
      supabase.removeChannel(channel);
    };
  }, [meta?.deviceId, meta?.page, meta?.playerName, options?.excludeSelf, presenceKey, room]);

  return count;
}
