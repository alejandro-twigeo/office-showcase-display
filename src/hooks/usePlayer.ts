import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PLAYER_KEY = 'twigeo-player';

export interface Player {
  id: string;
  name: string;
  office: string;
  avatar: string;
  created_at: string;
}

interface StoredPlayer {
  id: string;
  name: string;
  email?: string;
}

/** A profile someone could claim when they log in with their email for the first time */
export interface ClaimablePlayer {
  id: string;
  name: string;
  office: string;
  avatar: string;
  /** Looks like the name in the email (alejandro.x@ → "Alejandro") */
  likely: boolean;
}

export type EmailLoginResult =
  | { status: "ok" }
  | { status: "new"; suggestedName: string; claimable: ClaimablePlayer[] }
  | { status: "error"; error: string };

/**
 * Login is by work email (@twigeo.com), no password.
 * The email is kept in the players table's old `password_text` column, so no database change
 * is needed: when someone links their profile, their old password is replaced by their email.
 * Profiles still holding an old password are "unclaimed" and can be picked once by email.
 */
export const EMAIL_DOMAIN = "twigeo.com";
export const isWorkEmail = (email: string) => /^[a-z0-9._%+-]+@twigeo\.com$/i.test(email.trim());
const normalize = (email: string) => email.trim().toLowerCase();

/** "alejandro.garcia@twigeo.com" → "Alejandro" */
export function nameFromEmail(email: string) {
  const first = normalize(email).split("@")[0].split(/[._+-]/)[0] ?? "";
  return first ? first[0].toUpperCase() + first.slice(1) : "";
}

const PUBLIC_COLUMNS = "id, name, office, avatar, created_at";
// Untyped access for the email queries: the generated types still call this column password_text
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const playersTable = () => (supabase as any).from("players");

export function usePlayer(): {
  player: Player | null;
  isLoading: boolean;
  loginWithEmail: (email: string) => Promise<EmailLoginResult>;
  claimProfile: (playerId: string, email: string) => Promise<{ ok: boolean; error?: string }>;
  signupWithEmail: (email: string, name: string, office: string, avatar: string) => Promise<{ ok: boolean; error?: string }>;
  /** Logged in from before email login, with no email linked yet */
  needsEmail: boolean;
  linkEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: { name?: string; office?: string; avatar?: string }) => Promise<{ ok: boolean; error?: string }>;
} {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsEmail, setNeedsEmail] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const raw = localStorage.getItem(PLAYER_KEY);
        if (!raw) { setIsLoading(false); return; }
        const stored: StoredPlayer = JSON.parse(raw);

        const { data } = await supabase
          .from('players')
          .select(PUBLIC_COLUMNS)
          .eq('id', stored.id)
          .single();

        if (data) {
          setPlayer(data as Player);
          // Sessions from before email login: ask once for the work email
          const { count } = await playersTable()
            .select('id', { count: 'exact', head: true })
            .eq('id', stored.id)
            .ilike('password_text', '%@%');
          setNeedsEmail(!count);
        } else {
          localStorage.removeItem(PLAYER_KEY);
        }
      } catch {
        localStorage.removeItem(PLAYER_KEY);
      }
      setIsLoading(false);
    };
    restore();
  }, []);

  const remember = (p: Player, email: string) => {
    setPlayer(p);
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ id: p.id, name: p.name, email } satisfies StoredPlayer));
  };

  const loginWithEmail = useCallback(async (rawEmail: string): Promise<EmailLoginResult> => {
    const email = normalize(rawEmail);
    if (!isWorkEmail(email)) return { status: "error", error: `Use your @${EMAIL_DOMAIN} email` };

    const { data: found, error } = await playersTable()
      .select(PUBLIC_COLUMNS)
      .eq('password_text', email)
      .maybeSingle();
    if (error) return { status: "error", error: "Couldn't check right now. Try again" };
    if (found) {
      remember(found as Player, email);
      return { status: "ok" };
    }

    // First time with this email: offer the profiles nobody has claimed yet (no email on them)
    const { data: open } = await playersTable()
      .select('id, name, office, avatar')
      .not('password_text', 'ilike', '%@%')
      .order('name');
    const suggestedName = nameFromEmail(email);
    const first = suggestedName.toLowerCase();
    const claimable: ClaimablePlayer[] = ((open ?? []) as Omit<ClaimablePlayer, "likely">[])
      .map((p) => ({ ...p, likely: !!first && p.name.toLowerCase().startsWith(first.slice(0, 3)) }))
      .sort((a, b) => Number(b.likely) - Number(a.likely) || a.name.localeCompare(b.name));
    return { status: "new", suggestedName, claimable };
  }, []);

  const claimProfile = useCallback(async (playerId: string, rawEmail: string) => {
    const email = normalize(rawEmail);
    if (!isWorkEmail(email)) return { ok: false, error: `Use your @${EMAIL_DOMAIN} email` };
    const { data: taken } = await playersTable().select('name').eq('password_text', email).maybeSingle();
    if (taken) return { ok: false, error: `That email is already linked to ${taken.name}` };
    const { data, error } = await playersTable()
      .update({ password_text: email })
      .eq('id', playerId)
      // only if nobody has linked an email to it in the meantime
      .not('password_text', 'ilike', '%@%')
      .select(PUBLIC_COLUMNS)
      .maybeSingle();
    if (error || !data) return { ok: false, error: "That profile was just taken. Pick another one" };
    remember(data as Player, email);
    return { ok: true };
  }, []);

  const signupWithEmail = useCallback(async (rawEmail: string, name: string, office: string, avatar: string) => {
    const email = normalize(rawEmail);
    if (!isWorkEmail(email)) return { ok: false, error: `Use your @${EMAIL_DOMAIN} email` };
    const { data, error } = await playersTable()
      .insert({ name: name.trim(), password_text: email, office, avatar })
      .select(PUBLIC_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'That name is taken. Add your last initial?' };
      return { ok: false, error: error.message };
    }
    remember(data as Player, email);
    return { ok: true };
  }, []);

  const linkEmail = useCallback(async (rawEmail: string) => {
    if (!player) return { ok: false, error: 'Not logged in' };
    const email = normalize(rawEmail);
    if (!isWorkEmail(email)) return { ok: false, error: `Use your @${EMAIL_DOMAIN} email` };
    const { data: taken } = await playersTable().select('name').eq('password_text', email).maybeSingle();
    if (taken) return { ok: false, error: `That email is already linked to ${taken.name}` };
    const { error } = await playersTable().update({ password_text: email }).eq('id', player.id);
    if (error) return { ok: false, error: "Couldn't save right now. Try again" };
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ id: player.id, name: player.name, email } satisfies StoredPlayer));
    setNeedsEmail(false);
    return { ok: true };
  }, [player]);

  const logout = useCallback(() => {
    localStorage.removeItem(PLAYER_KEY);
    setPlayer(null);
    setNeedsEmail(false);
  }, []);

  const updateProfile = useCallback(async (updates: { name?: string; office?: string; avatar?: string }) => {
    if (!player) return { ok: false, error: 'Not logged in' };
    const { error } = await supabase
      .from('players')
      .update(updates as any)
      .eq('id', player.id);

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Name already taken' };
      return { ok: false, error: error.message };
    }

    setPlayer(prev => prev ? { ...prev, ...updates } : null);
    if (updates.name) {
      const raw = localStorage.getItem(PLAYER_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        stored.name = updates.name;
        localStorage.setItem(PLAYER_KEY, JSON.stringify(stored));
      }
    }
    return { ok: true };
  }, [player]);

  return { player, isLoading, loginWithEmail, claimProfile, signupWithEmail, needsEmail, linkEmail, logout, updateProfile };
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
