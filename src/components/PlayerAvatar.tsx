import { memo, type CSSProperties } from 'react';
import { BotAvatar } from 'bot-avatars';
import { botFor, seedFor, type BotConfig } from '@/lib/botAvatar';

/**
 * TV screens: a lighter finish. The plush fur is drawn pixel by pixel, which is a lot
 * for a TV browser with a full leaderboard. Change this in one place if the TVs cope.
 */
const TV_SHADING = 'smooth' as const;

interface PlayerAvatarProps {
  /** players.avatar: a saved bot, or an old emoji (then a bot is picked from the name) */
  avatar?: string | null;
  name: string;
  /** Pass a config directly instead (the picker's live preview) */
  bot?: BotConfig;
  /** px or any CSS length. Default 1.5em, so it scales with the text next to it */
  size?: number | string;
  state?: 'default' | 'working' | 'sleeping';
  /** No animation: for tiny avatars inside sentences */
  still?: boolean;
  /** On the TV dashboard */
  tv?: boolean;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const PlayerAvatar = memo(function PlayerAvatar({
  avatar, name, bot, size = '1.5em', state = 'default', still, tv, interactive = false, className = '', style,
}: PlayerAvatarProps) {
  const b = bot ?? botFor(avatar, name);
  return (
    <span className={`inline-flex shrink-0 items-center justify-center align-middle ${className}`} style={style} aria-hidden>
      <BotAvatar
        type={b.type}
        color={b.color ?? undefined}
        shading={tv ? TV_SHADING : b.shading}
        face={b.face}
        hat={b.hat}
        glasses={b.glasses}
        headphones={b.headphones}
        bowTie={b.bowTie}
        size={size}
        state={state}
        paused={still}
        interactive={interactive}
        seed={seedFor(name)}
      />
    </span>
  );
});
