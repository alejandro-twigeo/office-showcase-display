import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Key the old name-and-password login used. Cleared on load: everyone logs in again once. */
const OLD_PLAYER_KEY = 'twigeo-player';

export interface Player {
  id: string;
  name: string;
  office: string;
  avatar: string;
  created_at: string;
  department?: string | null;
  is_admin?: boolean;
}

/** A profile someone could claim on their first login */
export interface ClaimablePlayer {
  id: string;
  name: string;
  office: string;
  avatar: string;
  /** Looks like the name in the email (alejandro.x@ → "Alejandro") */
  likely: boolean;
}

/** First login: what we know about this person, to claim a profile or make one */
export interface ProfileSetup {
  email: string;
  suggestedName: string;
  office: string | null;
  department: string | null;
  claimable: ClaimablePlayer[];
}

/**
 * Login is an email to your @twigeo.com address with a Log in button (Supabase Auth).
 * If the email ever includes a 6-digit code instead, typing it in works too.
 * After that, the database links your account to your profile. On your very first login
 * you either claim your existing profile or make a new one. The database checks every
 * score, vote and kudos against the logged-in person, so nobody can post as someone else.
 */
export const EMAIL_DOMAIN = "twigeo.com";
export const isWorkEmail = (email: string) => /^[a-z0-9._%+-]+@twigeo\.com$/i.test(email.trim());
const normalize = (email: string) => email.trim().toLowerCase();

// The login functions aren't in the generated types yet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

const friendly = (message?: string) => {
  const m = message ?? '';
  if (m.includes('twigeo_only')) return `Only @${EMAIL_DOMAIN} emails can play`;
  if (m.includes('taken')) return 'That profile was just taken. Pick another one';
  if (m.includes('players_name_key') || m.includes('duplicate key')) return 'That name is taken. Add your last initial?';
  if (m.toLowerCase().includes('token') || m.toLowerCase().includes('otp')) return "That code didn't work. Check it, or send a new one";
  if (m.toLowerCase().includes('rate')) return 'Too many tries. Wait a minute and try again';
  return m || 'Something went wrong';
};

export function usePlayer(): {
  player: Player | null;
  isLoading: boolean;
  /** Logged in, but no profile yet: claim one or create one */
  setup: ProfileSetup | null;
  sendCode: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyCode: (email: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  claimProfile: (playerId: string) => Promise<{ ok: boolean; error?: string }>;
  createProfile: (name: string, office: string, avatar: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: { name?: string; office?: string; avatar?: string }) => Promise<{ ok: boolean; error?: string }>;
} {
  const [player, setPlayer] = useState<Player | null>(null);
  const [setup, setSetup] = useState<ProfileSetup | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Link the logged-in account to its profile (or learn what's needed to make one)
  const link = useCallback(async (email: string) => {
    const { data, error } = await rpc('link_my_player');
    if (error) {
      setPlayer(null);
      setSetup(null);
      return { ok: false, error: friendly(error.message) };
    }
    if (data?.status === 'ok') {
      setPlayer(data.player as Player);
      setSetup(null);
      return { ok: true };
    }
    const suggestedName: string = data?.suggested_name ?? '';
    const first = suggestedName.toLowerCase().slice(0, 3);
    const claimable: ClaimablePlayer[] = ((data?.claimable ?? []) as Omit<ClaimablePlayer, 'likely'>[])
      .map((p) => ({ ...p, likely: !!first && p.name.toLowerCase().startsWith(first) }))
      .sort((a, b) => Number(b.likely) - Number(a.likely) || a.name.localeCompare(b.name));
    setPlayer(null);
    setSetup({ email, suggestedName, office: data?.office ?? null, department: data?.department ?? null, claimable });
    return { ok: true };
  }, []);

  // Restore the session, and follow logins and logouts
  useEffect(() => {
    try { localStorage.removeItem(OLD_PLAYER_KEY); } catch { /* ignore */ }
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const email = data.session?.user.email;
      if (email && !cancelled) await link(email);
      if (!cancelled) setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setPlayer(null);
        setSetup(null);
      }
      // A login link opened in this browser also lands here
      if (event === 'SIGNED_IN' && session?.user.email) link(session.user.email);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [link]);

  const sendCode = useCallback(async (rawEmail: string) => {
    const email = normalize(rawEmail);
    if (!isWorkEmail(email)) return { ok: false, error: `Use your @${EMAIL_DOMAIN} email` };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // The email's Log in button returns here; main.tsx finishes the login and opens /play
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/` },
    });
    return error ? { ok: false, error: friendly(error.message) } : { ok: true };
  }, []);

  const verifyCode = useCallback(async (rawEmail: string, code: string) => {
    const email = normalize(rawEmail);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (error) return { ok: false, error: friendly(error.message) };
    return link(email);
  }, [link]);

  const claimProfile = useCallback(async (playerId: string) => {
    const { data, error } = await rpc('claim_player', { p_id: playerId });
    if (error) return { ok: false, error: friendly(error.message) };
    setPlayer(data as Player);
    setSetup(null);
    return { ok: true };
  }, []);

  const createProfile = useCallback(async (name: string, office: string, avatar: string) => {
    const { data, error } = await rpc('create_my_player', { p_name: name.trim(), p_office: office, p_avatar: avatar });
    if (error) return { ok: false, error: friendly(error.message) };
    setPlayer(data as Player);
    setSetup(null);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    supabase.auth.signOut();
    setPlayer(null);
    setSetup(null);
  }, []);

  const updateProfile = useCallback(async (updates: { name?: string; office?: string; avatar?: string }) => {
    if (!player) return { ok: false, error: 'Not logged in' };
    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', player.id);

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Name already taken' };
      return { ok: false, error: error.message };
    }

    setPlayer(prev => prev ? { ...prev, ...updates } : null);
    return { ok: true };
  }, [player]);

  return { player, isLoading, setup, sendCode, verifyCode, claimProfile, createProfile, logout, updateProfile };
}

/** Is the logged-in person the admin? Asked of the database, so it can't be faked in the browser. */
export function useIsAdmin() {
  return useQuery({
    queryKey: ['is-admin'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return false;
      const { data, error } = await rpc('is_admin');
      return !error && data === true;
    },
  });
}

export const AVATAR_OPTIONS = [
  '🐶', '🐱', '🦊', '🐸', '🐼', '🦁', '🐧', '🐙',
  '🦄', '🐺', '🐻', '🐨', '🐯', '🦋', '🐬', '🦉',
];

export const OFFICE_OPTIONS = ['Bulgaria', 'Sweden', 'US'] as const;

export const OFFICE_FLAGS: Record<string, string> = {
  Bulgaria: '🇧🇬',
  Sweden: '🇸🇪',
  US: '🇺🇸',
};
