import { describe, expect, it } from 'vitest';
import { botFor, botFromName, DEFAULT_BOT, isBotAvatar, parseBot, serializeBot } from '@/lib/botAvatar';

describe('bot avatars', () => {
  it('saves only what differs from the defaults, and reads it back', () => {
    const b = { ...DEFAULT_BOT, type: 'cat' as const, color: '#ff5c02', shading: 'plastic' as const, hat: 'beret' as const, glasses: 'shades' as const };
    const s = serializeBot(b);
    expect(s).toBe('{"t":"cat","c":"#FF5C02","s":"plastic","h":"beret","g":"shades"}');
    expect(parseBot(s)).toEqual({ ...b, color: '#FF5C02' });
  });

  it('treats old emoji avatars as not chosen yet, with a stable bot from the name', () => {
    expect(isBotAvatar('🐶')).toBe(false);
    expect(parseBot('{broken')).toBeNull();
    expect(parseBot('{"t":"dragon"}')).toBeNull();
    expect(botFor('🐶', 'Alejandro')).toEqual(botFromName('Alejandro'));
    expect(botFromName('Alejandro')).toEqual(botFromName(' alejandro '));
  });

  it('ignores unknown values inside a saved bot', () => {
    expect(parseBot('{"t":"star","c":"red","h":"tophat"}')).toEqual({ ...DEFAULT_BOT, type: 'star' });
  });
});
