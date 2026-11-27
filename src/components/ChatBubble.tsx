import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { rgbList } from '@/lib/botColour';
import '@/styles/chat-bubble.css';

/** How far a bubble leans toward the mouse, in px */
const PULL_X = 7;
const PULL_Y = 4;

/**
 * A chat bubble washed in the speaker's avatar colour, with a little tail pointing at them.
 * With a mouse, it leans toward the pointer and the colour pools under it, then springs back.
 * Touch and TV screens get the still version.
 */
export function ChatBubble({
  color, side = 'left', tail = false, className = '', children,
}: { color: string; side?: 'left' | 'right'; tail?: boolean; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty('--mx', `${((x - 0.5) * 2 * PULL_X).toFixed(1)}px`);
    el.style.setProperty('--my', `${((y - 0.5) * 2 * PULL_Y).toFixed(1)}px`);
    el.style.setProperty('--px', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--py', `${(y * 100).toFixed(1)}%`);
    el.dataset.hot = '';
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    for (const v of ['--mx', '--my', '--px', '--py']) el.style.removeProperty(v);
    delete el.dataset.hot;
  };

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      data-side={side}
      data-tail={tail ? '' : undefined}
      className={`chat-bubble ${className}`}
      style={{ '--c': rgbList(color) } as CSSProperties}
    >
      <span className="chat-bubble__wash" aria-hidden>
        <span className="chat-bubble__glow" />
      </span>
      {tail && <span className="chat-bubble__tail" aria-hidden />}
      <p className="relative break-words">{children}</p>
    </div>
  );
}

/** The avatar next to a bubble. `speaking` gives it a short chatter when its message lands. */
export function ChatSpeaker({ speaking, children }: { speaking?: boolean; children: ReactNode }) {
  return <span className={`chat-speaker ${speaking ? 'is-speaking' : ''}`}>{children}</span>;
}
