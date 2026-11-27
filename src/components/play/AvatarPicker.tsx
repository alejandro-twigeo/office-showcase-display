import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pipette, Shuffle } from 'lucide-react';
import { botAvatarPalette } from 'bot-avatars';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  BOT_COLOURS, BOT_FACES, BOT_FINISHES, BOT_GLASSES, BOT_HATS, BOT_SHAPES,
  randomBot, type BotConfig,
} from '@/lib/botAvatar';

interface AvatarPickerProps {
  value: BotConfig;
  onChange: (b: BotConfig) => void;
  /** Shown next to the preview */
  name: string;
  /** Under the name, e.g. the department */
  caption?: string;
}

const RAINBOW = 'conic-gradient(#FF5C02, #FFB224, #4CC468, #17C3AE, #3D8BFF, #9A62FF, #F2588E, #FF5C02)';

const chip = (on: boolean) =>
  `h-7 rounded-full px-2 text-xs sm:px-2.5 font-medium transition-colors ${
    on ? 'bg-foreground text-background' : 'bg-secondary hover:bg-border'
  }`;

/** One compact line: a small label on the left, the options on the right */
function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="flex min-w-0 items-start gap-2">
      <span className="w-12 shrink-0 pt-1.5 sm:w-14 text-xs font-semibold text-muted-foreground">{title}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Choices<T extends string>({ options, value, onChange }: {
  options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={chip(value === id)} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </>
  );
}

/**
 * Shapes, colours, finish, face and extras, sized to fit one screen (phone included).
 * The preview stays pinned at the top and hops on every change.
 */
export function AvatarPicker({ value, onChange, name, caption }: AvatarPickerProps) {
  const [hop, setHop] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const set = (patch: Partial<BotConfig>) => {
    onChange({ ...value, ...patch });
    setHop(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHop(false), 1400);
  };

  const preset = BOT_COLOURS.find((c) => c.value.toUpperCase() === value.color?.toUpperCase());
  const custom = value.color && !preset ? value.color : null;
  const shapeLabel = BOT_SHAPES.find(([id]) => id === value.type)?.[1];

  return (
    <div className="space-y-3">
      {/* Preview: pinned, so every change is visible even on a short screen */}
      <div className="sticky top-0 z-10 -mx-1 bg-background px-1 pb-1">
        <div className="flex items-center gap-3 rounded-2xl bg-secondary p-2 pr-3">
          <PlayerAvatar bot={value} name={name} size="clamp(64px, 18vw, 84px)" state={hop ? 'working' : 'default'} interactive />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold leading-tight">{name || 'You'}</p>
            <p className="truncate text-xs text-muted-foreground">{[caption, shapeLabel].filter(Boolean).join(' · ')}</p>
          </div>
          <button
            type="button"
            onClick={() => set(randomBot(value.shading))}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset ring-border hover:ring-foreground"
          >
            <Shuffle className="h-3.5 w-3.5" /> Shuffle
          </button>
        </div>
      </div>

      <fieldset>
        <legend className="sr-only">Shape</legend>
        <div className="grid grid-cols-9 gap-1">
          {BOT_SHAPES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={value.type === id}
              onClick={() => set({ type: id })}
              className={`grid aspect-square place-items-center rounded-lg border-2 transition-colors ${
                value.type === id ? 'border-foreground bg-card' : 'border-transparent bg-secondary hover:border-border'
              }`}
            >
              <PlayerAvatar
                bot={{ ...value, type: id, hat: 'none', glasses: 'none', headphones: false, bowTie: false }}
                name={id}
                size="clamp(22px, 6vw, 32px)"
                still
                className="pointer-events-none"
              />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="sr-only">Colour</legend>
        <div className="grid grid-cols-10 gap-1.5">
          {BOT_COLOURS.map((c) => {
            const on = preset?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={c.label}
                aria-pressed={on}
                title={c.label}
                onClick={() => set({ color: c.value })}
                className={`aspect-square w-full max-w-8 justify-self-center rounded-full ring-1 ring-inset ring-black/10 ${
                  on ? 'outline outline-2 outline-offset-2 outline-foreground' : ''
                }`}
                style={{ background: c.value }}
              />
            );
          })}
          {/* Any other colour: the system colour picker, over a swatch */}
          <label
            title="Pick any colour"
            className={`relative grid aspect-square w-full max-w-8 cursor-pointer place-items-center justify-self-center rounded-full ring-1 ring-inset ring-black/10 ${
              custom ? 'outline outline-2 outline-offset-2 outline-foreground' : ''
            }`}
            style={{ background: custom ?? RAINBOW }}
          >
            <Pipette className="pointer-events-none h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
            <input
              type="color"
              aria-label="Pick any colour"
              value={(value.color ?? botAvatarPalette[value.type] ?? '#FF5C02').toLowerCase()}
              onChange={(e) => set({ color: e.target.value.toUpperCase() })}
              className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
            />
          </label>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Row title="Finish">
          <Choices options={BOT_FINISHES} value={value.shading} onChange={(v) => set({ shading: v })} />
        </Row>
        <Row title="Face">
          <Choices options={BOT_FACES} value={value.face} onChange={(v) => set({ face: v })} />
        </Row>
        <Row title="Hat">
          <Choices options={BOT_HATS} value={value.hat} onChange={(v) => set({ hat: v })} />
        </Row>
        <Row title="Glasses">
          <Choices options={BOT_GLASSES} value={value.glasses} onChange={(v) => set({ glasses: v })} />
        </Row>
        <Row title="Extras">
          <button type="button" aria-pressed={value.headphones} className={chip(value.headphones)} onClick={() => set({ headphones: !value.headphones })}>
            Headphones
          </button>
          <button type="button" aria-pressed={value.bowTie} className={chip(value.bowTie)} onClick={() => set({ bowTie: !value.bowTie })}>
            Bow tie
          </button>
        </Row>
      </div>
    </div>
  );
}
