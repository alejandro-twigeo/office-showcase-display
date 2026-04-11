import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PresenceMeta = {
  deviceId?: string;
  playerName?: string;
  page?: "play" | "tv" | "manager";
  ts?: number;
};

type PresenceState = Record<string, Array<PresenceMeta>>;

interface PresenceSnapshot {
  count: number;
  playerNames: string[];
}

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
      const namedUsers = new Set<string>();

      for (const [key, entries] of Object.entries(state)) {
        for (const entry of entries) {
          const normalizedName = entry.playerName?.trim().toLowerCase();
          const isSelf =
            !!options?.excludeSelf &&
            (
              (!!meta?.playerName && normalizedName === meta.playerName.trim().toLowerCase()) ||
              (!!meta?.deviceId && !normalizedName && (entry.deviceId ?? key) === meta.deviceId)
            );
          if (isSelf) continue;
          if (normalizedName) {
            namedUsers.add(normalizedName);
          }
        }
      }

      setCount(namedUsers.size);
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

export function usePresenceSnapshot(
  room: string,
  meta?: PresenceMeta,
  options?: { excludeSelf?: boolean }
) {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>({ count: 0, playerNames: [] });
  const presenceKey = usePresenceKey(meta?.deviceId);

  useEffect(() => {
    const channel = supabase.channel(`presence:${room}`, {
      config: { presence: { key: presenceKey } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as PresenceState;
      const namedUsers = new Set<string>();
      const playerNames = new Map<string, string>();

      for (const [key, entries] of Object.entries(state)) {
        for (const entry of entries) {
          const rawName = entry.playerName?.trim();
          const normalizedName = rawName?.toLowerCase();
          const isSelf =
            !!options?.excludeSelf &&
            (
              (!!meta?.playerName && normalizedName === meta.playerName.trim().toLowerCase()) ||
              (!!meta?.deviceId && !normalizedName && (entry.deviceId ?? key) === meta.deviceId)
            );
          if (isSelf) continue;
          if (normalizedName && rawName) {
            namedUsers.add(normalizedName);
            if (!playerNames.has(normalizedName)) playerNames.set(normalizedName, rawName);
          }
        }
      }

      setSnapshot({
        count: namedUsers.size,
        playerNames: [...playerNames.values()].sort((a, b) => a.localeCompare(b)),
      });
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

  return snapshot;
}
