import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from './useDeviceId';

const VISIT_KEY = 'last-visit-logged';

/** Logs one visit per device per hour */
export function useVisitLogger() {
  useEffect(() => {
    const last = localStorage.getItem(VISIT_KEY);
    const now = Date.now();
    // Only log once per hour
    if (last && now - parseInt(last) < 60 * 60 * 1000) return;

    const deviceId = getDeviceId();
    localStorage.setItem(VISIT_KEY, String(now));
    supabase.from('visit_logs' as any).insert({ device_id: deviceId } as any).then();
  }, []);
}
