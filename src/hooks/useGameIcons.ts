import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GameIcons = Record<string, string>; // gameId -> public URL
export const LEADERBOARD_PLAYER_COUNT_KEY = '__leaderboard_player_count';

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
      const { [LEADERBOARD_PLAYER_COUNT_KEY]: _leaderboardPlayerCount, ...icons } = rawIcons;
      return icons as GameIcons;
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

    // Save to scoring_settings
    const current = query.data ?? {};
    const updated = { ...current, [gameId]: publicUrl };
    await supabase
      .from('scoring_settings' as any)
      .update({ game_icons: updated } as any)
      .eq('id', 1);

    queryClient.invalidateQueries({ queryKey: ['game_icons'] });
    return publicUrl;
  };

  const removeIcon = async (gameId: string) => {
    const current = query.data ?? {};
    const { [gameId]: _, ...rest } = current;
    await supabase
      .from('scoring_settings' as any)
      .update({ game_icons: rest } as any)
      .eq('id', 1);
    queryClient.invalidateQueries({ queryKey: ['game_icons'] });
  };

  return { icons: query.data ?? {}, isLoading: query.isLoading, uploadIcon, removeIcon };
}
