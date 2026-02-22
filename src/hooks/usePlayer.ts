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
  password: string;
}

export function usePlayer(): {
  player: Player | null;
  isLoading: boolean;
  login: (name: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (name: string, password: string, office: string, avatar: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: { name?: string; office?: string; avatar?: string }) => Promise<{ ok: boolean; error?: string }>;
} {
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const raw = localStorage.getItem(PLAYER_KEY);
        if (!raw) { setIsLoading(false); return; }
        const stored: StoredPlayer = JSON.parse(raw);

        const { data } = await supabase
          .from('players')
          .select('id, name, office, avatar, created_at')
          .eq('id', stored.id)
          .single();

        if (data) {
          setPlayer(data as Player);
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

  const login = useCallback(async (name: string, password: string) => {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, office, avatar, created_at, password_text')
      .eq('name', name)
      .single();

    if (error || !data) return { ok: false, error: 'Player not found' };
    if ((data as any).password_text !== password) return { ok: false, error: 'Wrong password' };

    const p: Player = { id: data.id, name: data.name, office: data.office, avatar: data.avatar, created_at: data.created_at };
    setPlayer(p);
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ id: p.id, name: p.name, password }));
    return { ok: true };
  }, []);

  const signup = useCallback(async (name: string, password: string, office: string, avatar: string) => {
    const { data, error } = await supabase
      .from('players')
      .insert({ name, password_text: password, office, avatar } as any)
      .select('id, name, office, avatar, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Name already taken' };
      return { ok: false, error: error.message };
    }

    const p = data as Player;
    setPlayer(p);
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ id: p.id, name: p.name, password }));
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(PLAYER_KEY);
    setPlayer(null);
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

  return { player, isLoading, login, signup, logout, updateProfile };
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
