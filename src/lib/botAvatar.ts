/**
 * Player avatars are little bots (the bot-avatars library).
 * The choice is saved as a short JSON string in players.avatar, so no database change is needed:
 *   {"t":"cat","c":"#FF5C02","s":"plastic","h":"beret","g":"shades"}
 * Only the fields that differ from the defaults are saved. Anything else in that column
 * (the old emoji avatars) still works: those players get a bot picked from their name
 * until they choose their own.
 */

export const BOT_SHAPES = [
  ['clover', 'Clover'], ['flower', 'Flower'], ['triangle', 'Triangle'], ['square', 'Square'],
  ['blob', 'Blob'], ['ghost', 'Ghost'], ['circle', 'Circle'], ['drop', 'Drop'], ['star', 'Star'],
  ['droid', 'Droid'], ['mech', 'Mech'], ['alien', 'Alien'], ['hexagon', 'Hexagon'], ['cat', 'Cat'],
  ['cloud', 'Cloud'], ['pill', 'Pill'], ['pebble', 'Pebble'], ['puddle', 'Puddle'],
] as const;

export const BOT_COLOURS = [
  { id: 'orange', label: 'Twigeo orange', value: '#FF5C02' },
  { id: 'sun', label: 'Sun', value: '#FFB224' },
  { id: 'pink', label: 'Pink', value: '#F2588E' },
  { id: 'violet', label: 'Violet', value: '#9A62FF' },
  { id: 'blue', label: 'Blue', value: '#3D8BFF' },
  { id: 'teal', label: 'Teal', value: '#17C3AE' },
  { id: 'green', label: 'Green', value: '#4CC468' },
  { id: 'cocoa', label: 'Cocoa', value: '#9A6B4F' },
  { id: 'stone', label: 'Stone', value: '#CFC8C1' },
] as const;

export const BOT_FINISHES = [['fabric', 'Plush'], ['plastic', 'Glossy'], ['crisp', 'Clean']] as const;
export const BOT_FACES = [['eyes', 'Eyes'], ['mouth', 'Eyes + mouth']] as const;
export const BOT_HATS = [['none', 'None'], ['beanie', 'Beanie'], ['beret', 'Beret'], ['party', 'Party'], ['crown', 'Crown']] as const;
export const BOT_GLASSES = [['none', 'None'], ['round', 'Round'], ['square', 'Square'], ['shades', 'Shades']] as const;

export type BotShape = (typeof BOT_SHAPES)[number][0];
export type BotFinish = (typeof BOT_FINISHES)[number][0];
export type BotFace = (typeof BOT_FACES)[number][0];
export type BotHat = (typeof BOT_HATS)[number][0];
export type BotGlasses = (typeof BOT_GLASSES)[number][0];

export interface BotConfig {
  type: BotShape;
  /** null: the shape's own colour */
  color: string | null;
  shading: BotFinish;
  face: BotFace;
  hat: BotHat;
  glasses: BotGlasses;
  headphones: boolean;
  bowTie: boolean;
}

export const DEFAULT_BOT: BotConfig = {
  type: 'clover', color: null, shading: 'fabric', face: 'eyes',
  hat: 'none', glasses: 'none', headphones: false, bowTie: false,
};

const ids = <T extends readonly (readonly [string, string])[]>(list: T) => new Set(list.map((x) => x[0]));
const SHAPE_IDS = ids(BOT_SHAPES);
const FINISH_IDS = ids(BOT_FINISHES);
const FACE_IDS = ids(BOT_FACES);
const HAT_IDS = ids(BOT_HATS);
const GLASSES_IDS = ids(BOT_GLASSES);
const HEX = /^#[0-9a-f]{6}$/i;

/** Is this avatar string a chosen bot (and not an old emoji)? */
export function isBotAvatar(avatar: string | null | undefined): boolean {
  return parseBot(avatar) !== null;
}

/** The saved bot, or null for anything else (old emoji, empty, broken JSON). */
export function parseBot(avatar: string | null | undefined): BotConfig | null {
  if (!avatar || avatar[0] !== '{') return null;
  try {
    const o = JSON.parse(avatar);
    if (!o || !SHAPE_IDS.has(o.t)) return null;
    return {
      type: o.t,
      color: typeof o.c === 'string' && HEX.test(o.c) ? o.c : null,
      shading: FINISH_IDS.has(o.s) ? o.s : DEFAULT_BOT.shading,
      face: FACE_IDS.has(o.f) ? o.f : DEFAULT_BOT.face,
      hat: HAT_IDS.has(o.h) ? o.h : 'none',
      glasses: GLASSES_IDS.has(o.g) ? o.g : 'none',
      headphones: o.hp === 1,
      bowTie: o.bt === 1,
    };
  } catch {
    return null;
  }
}

/** The string saved in players.avatar */
export function serializeBot(b: BotConfig): string {
  const o: Record<string, string | number> = { t: b.type };
  if (b.color) o.c = b.color.toUpperCase();
  if (b.shading !== DEFAULT_BOT.shading) o.s = b.shading;
  if (b.face !== DEFAULT_BOT.face) o.f = b.face;
  if (b.hat !== 'none') o.h = b.hat;
  if (b.glasses !== 'none') o.g = b.glasses;
  if (b.headphones) o.hp = 1;
  if (b.bowTie) o.bt = 1;
  return JSON.stringify(o);
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable bot for someone who hasn't picked one yet: same name, same bot, everywhere. */
export function botFromName(name: string): BotConfig {
  const h = hash(name.trim().toLowerCase() || '?');
  return { ...DEFAULT_BOT, type: BOT_SHAPES[h % BOT_SHAPES.length][0] };
}

/** What to draw for a player: their chosen bot, or the one from their name. */
export function botFor(avatar: string | null | undefined, name: string): BotConfig {
  return parseBot(avatar) ?? botFromName(name);
}

/** Seed (0–1) so a row of avatars doesn't blink in unison */
export const seedFor = (name: string) => (hash(name) % 1000) / 1000;

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

export function randomBot(keepFinish?: BotFinish): BotConfig {
  return {
    type: pick(BOT_SHAPES)[0],
    color: pick(BOT_COLOURS).value,
    shading: keepFinish ?? DEFAULT_BOT.shading,
    face: pick(BOT_FACES)[0],
    hat: Math.random() < 0.5 ? 'none' : pick(BOT_HATS.slice(1))[0],
    glasses: Math.random() < 0.6 ? 'none' : pick(BOT_GLASSES.slice(1))[0],
    headphones: Math.random() < 0.2,
    bowTie: Math.random() < 0.2,
  };
}
