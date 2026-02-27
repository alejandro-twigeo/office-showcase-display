import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PresenceState = Record<string, Array<{ deviceId?: string; playerName?: string }>>;

export function usePresenceCount(room: string, meta?: { deviceId?: string; playerName?: string }) {
  const [count, setCount] = useState(0);

  // stable unique key per tab/device
  const presenceKey = useMemo(() => {
    const base = meta?.deviceId ?? crypto.randomUUID();
    return `${base}-${Math.random().toString(16).slice(2)}`; // avoids collisions across tabs
  }, [meta?.deviceId]);

  useEffect(() => {
    const channel = supabase.channel(`presence:${room}`, {
      config: { presence: { key: presenceKey } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as PresenceState;
      const total = Object.values(state).reduce((sum, arr) => sum + arr.length, 0);
      setCount(total);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track({
          deviceId: meta?.deviceId,
          playerName: meta?.playerName,
          ts: Date.now(),
        });
      }
    });

    // keep-alive so long-lived tabs don’t get dropped on flaky networks
    const ping = window.setInterval(() => {
      channel.track({ deviceId: meta?.deviceId, playerName: meta?.playerName, ts: Date.now() });
    }, 30_000);

    return () => {
      window.clearInterval(ping);
      supabase.removeChannel(channel);
    };
  }, [room, presenceKey, meta?.deviceId, meta?.playerName]);

  return count;
}