import { botAvatarPalette } from 'bot-avatars';
import { botFor } from '@/lib/botAvatar';

const FALLBACK = '#FF5C02';

/** The body colour a player's bot is drawn in: their chosen colour, or the shape's own. */
export function botColour(avatar: string | null | undefined, name: string): string {
  const b = botFor(avatar, name);
  return b.color ?? botAvatarPalette[b.type] ?? FALLBACK;
}

/** "#41C4FF" → "65, 196, 255", for rgba(var(--c), a) in CSS (works on older TV browsers) */
export function rgbList(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()) ?? /^#?([0-9a-f]{6})$/i.exec(FALLBACK)!;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
