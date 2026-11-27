import { useEffect, useRef, useState } from "react";
import { Liquid } from "liquid-gooey";

type QueueItem = { id: string; title: string; thumbnail_url: string | null };

type Drag = {
  from: number;
  to: number;
  dy: number; // how far the dragged thumbnail is from its own slot, in px
  slot: number; // one thumbnail plus the gap, in px
  settling: boolean; // let go: gliding into its new slot
};

const SLIDE = "transform 320ms cubic-bezier(0.34, 1.4, 0.64, 1)"; // small, liquid overshoot
const SETTLE_MS = 200;
const EDGE = 28; // px from the top/bottom edge where dragging starts scrolling

/**
 * The slim thumbnail strip next to Now playing. It scrolls when there are more songs than fit,
 * with a soft blur at whichever end has more songs behind it. Put the ＋ right after it in a
 * flex column: the strip shrinks to fit, so the ＋ sits below the last song and never scrolls away.
 * On a laptop you can drag songs up and down: the thumbnails sit on
 * a liquid surface, so the one you move pulls a gooey trail and merges with its neighbours.
 */
export function QueueStrip({
  items,
  canReorder,
  onReorder,
}: {
  items: QueueItem[];
  canReorder: boolean;
  onReorder: (ids: string[], onFail: () => void) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The new order, shown right away while the database catches up
  const [order, setOrder] = useState<string[] | null>(null);
  const serverKey = items.map((i) => i.id).join(",");
  // Drop it once the database has the same order (it updates one song at a time, so wait for all
  // of them), or straight away if songs were added or removed meanwhile
  useEffect(() => {
    setOrder((o) => {
      if (!o) return o;
      const sameSongs = o.length === items.length && [...o].sort().join() === items.map((i) => i.id).sort().join();
      return !sameSongs || o.join(",") === serverKey ? null : o;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const shown = order ? order.map((id) => byId.get(id)).filter((i): i is QueueItem => !!i) : items;

  /* ── Soft ends: only where there's more to scroll to ── */
  const [ends, setEnds] = useState({ top: false, bottom: false });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () =>
      setEnds({
        top: el.scrollTop > 2,
        bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 2,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (listRef.current) ro.observe(listRef.current);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  /* ── Drag to reorder (mouse and pen; touch scrolls) ── */
  const [drag, setDrag] = useState<Drag | null>(null);
  // Right after a drop the DOM order changes: skip the slide for that one frame
  const [instant, setInstant] = useState(false);
  const g = useRef<{
    from: number;
    startY: number;
    startScroll: number;
    lastY: number;
    slot: number;
    started: boolean;
    raf: number;
  } | null>(null);

  const targetFor = (from: number, dy: number, slot: number) =>
    Math.max(0, Math.min(shown.length - 1, from + Math.round(dy / slot)));

  const recompute = () => {
    const s = g.current;
    const el = scrollRef.current;
    if (!s || !el || !s.started) return;
    const dy = s.lastY - s.startY + (el.scrollTop - s.startScroll);
    setDrag({ from: s.from, to: targetFor(s.from, dy, s.slot), dy, slot: s.slot, settling: false });
  };

  // Near the top or bottom edge, keep scrolling while you hold the song there
  const autoScroll = () => {
    const s = g.current;
    const el = scrollRef.current;
    if (!s || !el) return;
    const r = el.getBoundingClientRect();
    const speed =
      s.lastY < r.top + EDGE ? -Math.ceil((r.top + EDGE - s.lastY) / 4) : s.lastY > r.bottom - EDGE ? Math.ceil((s.lastY - (r.bottom - EDGE)) / 4) : 0;
    if (speed) {
      el.scrollTop += speed;
      recompute();
    }
    s.raf = requestAnimationFrame(autoScroll);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, idx: number) => {
    if (!canReorder || e.button !== 0 || e.pointerType === "touch" || drag?.settling) return;
    const el = scrollRef.current;
    const list = listRef.current;
    if (!el || !list) return;
    const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    g.current = {
      from: idx,
      startY: e.clientY,
      startScroll: el.scrollTop,
      lastY: e.clientY,
      slot: e.currentTarget.offsetHeight + gap,
      started: false,
      raf: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = g.current;
    if (!s) return;
    s.lastY = e.clientY;
    if (!s.started) {
      if (Math.abs(e.clientY - s.startY) < 4) return; // a click, not a drag
      s.started = true;
      s.raf = requestAnimationFrame(autoScroll);
    }
    recompute();
  };

  const onPointerUp = () => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    if (!s.started || !drag) return setDrag(null);
    const { from, to } = drag;
    // Glide into the new slot, then swap the real order underneath
    setDrag({ ...drag, dy: (to - from) * drag.slot, settling: true });
    setTimeout(() => {
      if (from !== to) {
        const ids = shown.map((i) => i.id);
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);
        setOrder(ids);
        onReorder(ids, () => setOrder(null));
      }
      setInstant(true);
      setDrag(null);
      requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    }, SETTLE_MS);
  };

  useEffect(() => () => cancelAnimationFrame(g.current?.raf ?? 0), []);

  // How far each thumbnail moves out of the way while one is dragged
  const offsetFor = (idx: number) => {
    if (!drag) return 0;
    if (idx === drag.from) return drag.dy;
    if (drag.from < drag.to && idx > drag.from && idx <= drag.to) return -drag.slot;
    if (drag.to < drag.from && idx >= drag.to && idx < drag.from) return drag.slot;
    return 0;
  };

  return (
    <div className="relative flex min-h-0 shrink flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 overflow-y-auto overscroll-contain px-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Liquid
          ref={listRef}
          blur={4}
          contrast={18}
          fill="hsl(var(--secondary))"
          filterPadding={32}
          className="flex flex-col gap-[clamp(6px,0.5vw,10px)]"
        >
          {shown.map((item, idx) => {
            const isDragged = drag?.from === idx;
            const y = offsetFor(idx);
            return (
              <Liquid.Item
                key={item.id}
                effect="move"
                move={{ springiness: 0.55, wobble: 0.45, stretch: 0.3, trail: 0.5 }}
              >
                <div
                  title={`${idx + 1}. ${item.title}${canReorder ? "  (drag to reorder)" : ""}`}
                  onPointerDown={(e) => onPointerDown(e, idx)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    zIndex: isDragged ? 10 : undefined, // stays above the songs it passes
                    transform: `translateY(${y}px) scale(${isDragged && !drag?.settling ? 1.03 : 1})`,
                    transition: instant || (isDragged && !drag?.settling) ? "none" : isDragged ? `transform ${SETTLE_MS}ms ease-out` : SLIDE,
                  }}
                  className={`relative w-full select-none rounded-[clamp(4px,0.4vw,8px)] ${
                    canReorder ? (isDragged ? "cursor-grabbing" : "cursor-grab") : ""
                  } ${isDragged && !drag?.settling ? "shadow-[0_10px_24px_-12px_hsl(var(--foreground)/0.45)]" : ""}`}
                >
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      draggable={false}
                      className="pointer-events-none w-full aspect-video rounded-[inherit] object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-video rounded-[inherit] bg-secondary" />
                  )}
                  <span className="absolute left-[3px] top-[3px] rounded-full bg-background/85 px-[0.4em] text-[clamp(9px,0.6vw,13px)] font-semibold tabular-nums">
                    {drag && !isDragged ? idx + 1 + (y > 0 ? 1 : y < 0 ? -1 : 0) : drag ? drag.to + 1 : idx + 1}
                  </span>
                </div>
              </Liquid.Item>
            );
          })}
        </Liquid>
      </div>

      {/* Soft ends: a light blur that fades in where songs continue past the edge */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-[clamp(16px,1.4vw,28px)] bg-gradient-to-b from-[hsl(var(--card))] to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_bottom,black,transparent)] transition-opacity duration-300 ${
          ends.top ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[clamp(16px,1.4vw,28px)] bg-gradient-to-t from-[hsl(var(--card))] to-transparent backdrop-blur-[3px] [mask-image:linear-gradient(to_top,black,transparent)] transition-opacity duration-300 ${
          ends.bottom ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
