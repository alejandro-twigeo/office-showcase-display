import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const VISIT_KEY = 'last-visit-logged';
const PLAYER_NAME_KEY = 'office-tv-player-name';

/** Logs one visit per player per hour */
export function useVisitLogger() {
  useEffect(() => {
    const playerName = localStorage.getItem(PLAYER_NAME_KEY);
    if (!playerName) return; // Only log for logged-in users

    const last = localStorage.getItem(VISIT_KEY);
    const now = Date.now();
    if (last && now - parseInt(last) < 60 * 60 * 1000) return;

    localStorage.setItem(VISIT_KEY, String(now));
    supabase.from('visit_logs' as any).insert({ player_name: playerName } as any).then();
  }, []);
}
