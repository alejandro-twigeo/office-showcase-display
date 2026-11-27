import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Shuffle } from 'lucide-react';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  BOT_COLOURS, BOT_FACES, BOT_FINISHES, BOT_GLASSES, BOT_HATS, BOT_SHAPES,
  randomBot, type BotConfig,
} from '@/lib/botAvatar';

interface AvatarPickerProps {
  value: BotConfig;
  onChange: (b: BotConfig) => void;
  /** Shown under the preview */
  name: string;
  /** Under the name, e.g. the department */
  caption?: string;
}

const chip = (on: boolean) =>
  `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
    on ? 'bg-foreground text-background' : 'bg-secondary hover:bg-border'
  }`;

function Section({ title, value, children }: { title: string; value?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">
        {title}
        {value && <span className="ml-1.5 font-normal text-muted-foreground">{value}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Choices<T extends string>({ name, options, value, onChange }: {
  name: string; options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={name}>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={chip(value === id)} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** Shapes, colours, finish, face and extras, with a live preview that hops on every change. */
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

  const colour = BOT_COLOURS.find((c) => c.value === value.color) ?? BOT_COLOURS[0];
  const shapeLabel = BOT_SHAPES.find(([id]) => id === value.type)?.[1];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl bg-secondary p-3 pr-4">
        <PlayerAvatar bot={value} name={name} size={104} state={hop ? 'working' : 'default'} interactive />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold leading-tight">{name || 'You'}</p>
          {caption && <p className="truncate text-sm text-muted-foreground">{caption}</p>}
          <button
            type="button"
            onClick={() => set(randomBot(value.shading))}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-border hover:ring-foreground"
          >
            <Shuffle className="h-3.5 w-3.5" /> Shuffle
          </button>
        </div>
      </div>

      <Section title="Shape" value={shapeLabel}>
        <div className="grid grid-cols-6 gap-1.5">
          {BOT_SHAPES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={value.type === id}
              onClick={() => set({ type: id })}
              className={`grid aspect-square place-items-center rounded-xl border-2 transition-colors ${
                value.type === id ? 'border-foreground bg-card' : 'border-transparent bg-secondary hover:border-border'
              }`}
            >
              <PlayerAvatar
                bot={{ ...value, type: id, hat: 'none', glasses: 'none', headphones: false, bowTie: false }}
                name={id}
                size={38}
                still
                className="pointer-events-none"
              />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Colour" value={colour.label}>
        <div className="grid grid-cols-10 gap-1.5">
          {BOT_COLOURS.map((c) => {
            const on = colour.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={c.label}
                aria-pressed={on}
                title={c.label}
                onClick={() => set({ color: c.value })}
                className={`aspect-square w-full max-w-9 rounded-full ring-1 ring-inset ring-black/10 ${
                  on ? 'outline outline-2 outline-offset-2 outline-foreground' : ''
                }`}
                style={{
                  background: c.value ?? 'conic-gradient(#41C4FF, #2FCB7A, #EFDB8E, #EAA06F, #EB7575, #EE8BDB, #9A62FF, #41C4FF)',
                }}
              />
            );
          })}
        </div>
      </Section>

      <Section title="Finish">
        <Choices name="Finish" options={BOT_FINISHES} value={value.shading} onChange={(v) => set({ shading: v })} />
      </Section>
      <Section title="Face">
        <Choices name="Face" options={BOT_FACES} value={value.face} onChange={(v) => set({ face: v })} />
      </Section>
      <Section title="Hat">
        <Choices name="Hat" options={BOT_HATS} value={value.hat} onChange={(v) => set({ hat: v })} />
      </Section>
      <Section title="Glasses">
        <Choices name="Glasses" options={BOT_GLASSES} value={value.glasses} onChange={(v) => set({ glasses: v })} />
      </Section>
      <Section title="Extras">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={value.headphones} className={chip(value.headphones)} onClick={() => set({ headphones: !value.headphones })}>
            Headphones
          </button>
          <button type="button" aria-pressed={value.bowTie} className={chip(value.bowTie)} onClick={() => set({ bowTie: !value.bowTie })}>
            Bow tie
          </button>
        </div>
      </Section>
    </div>
  );
}
