import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/hooks/useDeviceId';

const VISIT_KEY = 'last-visit-logged';
const HOUR = 60 * 60 * 1000;

/**
 * Logs a visit for whoever is logged in, at most once an hour per person and device
 * (Usage Analytics in Manager counts these). The TV and logged-out pages log nothing.
 */
export function useVisitLogger() {
  useEffect(() => {
    let cancelled = false;

    const log = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      // The logged-in person's name, as the database knows it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: name } = await (supabase as any).rpc('my_player_name');
      if (!name || cancelled) return;
      const key = `${VISIT_KEY}:${name}`;
      const last = Number(localStorage.getItem(key) || 0);
      if (Date.now() - last < HOUR) return;
      localStorage.setItem(key, String(Date.now()));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('visit_logs' as any).insert({ player_name: name, device_id: getDeviceId() } as any);
    };

    log();
    // Logging in, and coming back to the tab after a while, count too
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') log();
    });
    const onVisible = () => document.visibilityState === 'visible' && log();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
