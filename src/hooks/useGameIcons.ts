import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GameIcons = Record<string, string>; // gameId -> public URL
export const LEADERBOARD_PLAYER_COUNT_KEY = '__leaderboard_player_count';
export const SUDOKU_HINT_PENALTY_KEY = '__sudoku_hint_penalty';
const DEFAULT_LEADERBOARD_PLAYER_COUNT = 3;

function stripReservedKeys(rawIcons: GameIcons): GameIcons {
  return Object.fromEntries(
    Object.entries(rawIcons).filter(([key]) => !key.startsWith('__'))
  ) as GameIcons;
}

export function useGameIcons() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['game_icons'],
    queryFn: async () => {
      const { data } = await supabase
        .from('scoring_settings' as any)
        .select('game_icons')
        .eq('id', 1)
        .single();
      const rawIcons = ((data as any)?.game_icons ?? {}) as GameIcons;
      return stripReservedKeys(rawIcons);
    },
  });

  const uploadIcon = async (gameId: string, file: File) => {
    const ext = file.name.split('.').pop() || 'png';
    const path = `${gameId}.${ext}`;

    // Upload (overwrite)
    const { error: uploadErr } = await supabase.storage
      .from('game-icons')
      .upload(path, file, { upsert: true });
    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage
      .from('game-icons')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl + '?t=' + Date.now();

    const { data: settingsData } = await supabase
      .from('scoring_settings' as any)
      .select('game_icons')
      .eq('id', 1)
      .single();
    const current = ((settingsData as any)?.game_icons ?? {}) as GameIcons;
    const updated = { ...current, [gameId]: publicUrl };
    await supabase
      .from('scoring_settings' as any)
      .update({ game_icons: updated } as any)
      .eq('id', 1);

    queryClient.invalidateQueries({ queryKey: ['game_icons'] });
    return publicUrl;
  };

  const removeIcon = async (gameId: string) => {
    const { data: settingsData } = await supabase
      .from('scoring_settings' as any)
      .select('game_icons')
      .eq('id', 1)
      .single();
    const current = ((settingsData as any)?.game_icons ?? {}) as GameIcons;
    const { [gameId]: _, ...rest } = current;
    await supabase
      .from('scoring_settings' as any)
      .update({ game_icons: rest } as any)
      .eq('id', 1);
    queryClient.invalidateQueries({ queryKey: ['game_icons'] });
  };

  return { icons: query.data ?? {}, isLoading: query.isLoading, uploadIcon, removeIcon };
}

export function useLeaderboardPlayerCount() {
  return useQuery({
    queryKey: ['leaderboard_player_count'],
    queryFn: async () => {
      const { data } = await supabase
        .from('scoring_settings' as any)
        .select('game_icons')
        .eq('id', 1)
        .single();
      const rawIcons = ((data as any)?.game_icons ?? {}) as Record<string, unknown>;
      const count = Number(rawIcons[LEADERBOARD_PLAYER_COUNT_KEY] ?? DEFAULT_LEADERBOARD_PLAYER_COUNT);
      return Number.isFinite(count) && count > 0 ? count : DEFAULT_LEADERBOARD_PLAYER_COUNT;
    },
  });
}
