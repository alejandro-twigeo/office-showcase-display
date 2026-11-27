import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BotAvatar } from 'bot-avatars';
import { botFor, seedFor, type BotConfig } from '@/lib/botAvatar';

/**
 * TV screens: a lighter finish. The plush fur is drawn pixel by pixel, which is a lot
 * for a TV browser with a full leaderboard. Change this in one place if the TVs cope.
 */
const TV_SHADING = 'smooth' as const;

/**
 * Why most avatars use a lighter finish:
 * Plush (fur) and Glossy are painted from big textures baked per shape, and the library keeps
 * only a couple of dozen of them. A phone screen with many different bots (chat, leaderboards,
 * kudos) runs past that, and on iPhones the textures also hit Safari's canvas memory limit.
 * Then a bot waits up to 4 s before it shows, or stays empty. So lists and small avatars get a
 * light version of the same look (no textures, drawn at once, always shows), and the full finish
 * is kept for the big preview in the avatar picker, where you choose it.
 */
const LIGHT = {
  fabric: { shading: 'smooth', highlight: 1.15, spread: 1.7 }, // soft and matte, like plush
  plastic: { shading: 'smooth', highlight: 1.9, spread: 0.85 }, // a tighter, brighter highlight, like gloss
  crisp: { shading: 'crisp' },
} as const;

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
  /** Draw the full Plush / Glossy finish. On by default only for the picker's big preview. */
  detail?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const PlayerAvatar = memo(function PlayerAvatar({
  avatar, name, bot, size = '1.5em', state = 'default', still, tv, interactive = false, detail, className = '', style,
}: PlayerAvatarProps) {
  const b = bot ?? botFor(avatar, name);
  // The picker's live preview (a bot passed in, moving) shows the real finish
  const full = !tv && (detail ?? (!!bot && !still)) && (b.shading === 'fabric' || b.shading === 'plastic');

  // Safety net for the full finish: if it hasn't painted after a few seconds (out of canvas memory),
  // fall back to the light version instead of leaving an empty space
  const box = useRef<HTMLSpanElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!full) return;
    setFailed(false);
    const t = setTimeout(() => {
      const c = box.current?.querySelector('canvas');
      const ctx = c?.getContext('2d');
      if (!c || !ctx || !c.width) return setFailed(true);
      try {
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 32) if (d[i] > 0) return; // something is painted
        setFailed(true);
      } catch {
        /* can't read it back: leave it */
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [full, b.type, b.shading]);

  const finish = tv ? { shading: TV_SHADING } : full && !failed ? { shading: b.shading } : LIGHT[b.shading as keyof typeof LIGHT] ?? LIGHT.fabric;

  return (
    <span ref={box} className={`inline-flex shrink-0 items-center justify-center align-middle ${className}`} style={style} aria-hidden>
      <BotAvatar
        type={b.type}
        color={b.color ?? undefined}
        {...finish}
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
