import { useEffect, useRef } from "react";

/**
 * VaporClock: the current time (HH:MM) drawn as grains. When a digit changes, the old one
 * sublimates into grains drifting up on a curl-noise wind and the new one condenses from the
 * same cloud. Adapted from the "vapor digits" countdown: same physics, but a clock with
 * 4 digits, a colon, and one transition a minute. A real <time> element underneath keeps it
 * readable for screen readers, and it shows plain digits when reduced motion is on.
 *
 * Preview: add ?vapor to the address to make the minutes tick every 4 seconds.
 */

// deterministic 2-octave value noise for the wind field
function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function noise2(x: number, y: number) {
  return 0.65 * vnoise(x, y) + 0.35 * vnoise(x * 2.1 + 19.7, y * 2.1 + 7.3);
}

const DIGITS = 4;
const FLOATS = 6; // grains: x, y, vx, vy, hx, hy · vapor: x, y, vx, vy, age, life
const MAX_GRAINS = 2500; // per digit
const SAMPLE_STRIDE = 2; // px between samples on the glyph raster (denser than the original, the clock is smaller)
const GRAIN = 1.8; // px grain size
const SPRING_K = 90;
const ZETA = 0.55;
const DRAG = 0.92;
const DT_MAX = 0.032;
const FIELD_SCALE = 0.008;
const CURL_EPS = 0.75;
const PAD_X = 40; // canvas overdraw so the vapor isn't clipped
const PAD_TOP = 90;
const PAD_BOTTOM = 16;

type Slot = { g: Float32Array; v: Float32Array; gc: number; vc: number; active: boolean };

const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

export function VaporClock({ className = "" }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLTimeElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const timeEl = timeRef.current;
    if (!root || !canvas || !timeEl) return;
    const digitEls = Array.from(root.querySelectorAll<HTMLSpanElement>("[data-vc-digit]"));
    if (digitEls.length !== DIGITS) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // ?vapor: fast-forward one "minute" every 4 seconds so the effect can be seen
    const preview = new URLSearchParams(window.location.search).has("vapor");
    const startedAt = Date.now();
    const now = () => (preview ? new Date(startedAt + Math.floor((Date.now() - startedAt) / 4000) * 60_000) : new Date());
    const toDigits = () => fmt.format(now()).replace(":", "");

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let digits = toDigits();

    const applyDateTime = () => {
      timeEl.setAttribute("datetime", `${digits.slice(0, 2)}:${digits.slice(2)}`);
      timeEl.setAttribute("aria-label", `${digits.slice(0, 2)}:${digits.slice(2)}`);
    };

    const ctx = canvas.getContext("2d");
    let grainColor = "#1a1a1a";
    const updateGrainColor = () => {
      grainColor = getComputedStyle(digitEls[0]).color || grainColor;
    };
    updateGrainColor();

    const slots: Slot[] = Array.from({ length: DIGITS }, () => ({
      g: new Float32Array(MAX_GRAINS * FLOATS),
      v: new Float32Array(MAX_GRAINS * FLOATS),
      gc: 0,
      vc: 0,
      active: false,
    }));
    let glyphs: Float32Array[] | null = null;
    let cells: { x: number; y: number }[] = [];
    let cw = 0;
    let ch = 0;
    let lastW = 0;
    let lastH = 0;
    let raf = 0;
    let last = 0;
    const dampC = 2 * ZETA * Math.sqrt(SPRING_K);
    const half = GRAIN / 2;

    const loop = (t: number) => {
      if (!ctx) return;
      const dt = Math.min(Math.max((t - last) / 1000, 0), DT_MAX);
      last = t;
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = grainColor;
      let anyActive = false;

      for (let s = 0; s < DIGITS; s++) {
        const slot = slots[s];
        const g = slot.g;
        const v = slot.v;

        if (!slot.active) {
          ctx.globalAlpha = 0.95;
          for (let i = 0; i < slot.gc; i++) {
            const o = i * FLOATS;
            ctx.fillRect(g[o] - half, g[o + 1] - half, GRAIN, GRAIN);
          }
          continue;
        }
        anyActive = true;
        let settled = true;

        // incoming grains: spring toward their place in the new digit
        for (let i = 0; i < slot.gc; i++) {
          const o = i * FLOATS;
          let x = g[o];
          let y = g[o + 1];
          let vx = g[o + 2];
          let vy = g[o + 3];
          const hx = g[o + 4];
          const hy = g[o + 5];
          vx = (vx + (SPRING_K * (hx - x) - dampC * vx) * dt) * DRAG;
          vy = (vy + (SPRING_K * (hy - y) - dampC * vy) * dt) * DRAG;
          x += vx * dt;
          y += vy * dt;
          g[o] = x;
          g[o + 1] = y;
          g[o + 2] = vx;
          g[o + 3] = vy;
          if (Math.abs(x - hx) > 0.5 || Math.abs(y - hy) > 0.5 || Math.abs(vx) > 2 || Math.abs(vy) > 2) settled = false;
          const speed = Math.hypot(vx, vy);
          ctx.globalAlpha = 0.95 - 0.35 * Math.min(1, speed / 500);
          ctx.fillRect(x - half, y - half, GRAIN, GRAIN);
        }

        // vapor: curl-noise wind, drifting up, fading out
        let j = 0;
        while (j < slot.vc) {
          const o = j * FLOATS;
          const age = v[o + 4] + dt * 1000;
          const life = v[o + 5];
          if (age >= life) {
            const lo = (slot.vc - 1) * FLOATS;
            for (let k = 0; k < FLOATS; k++) v[o + k] = v[lo + k];
            slot.vc--;
            continue;
          }
          v[o + 4] = age;
          let x = v[o];
          let y = v[o + 1];
          let vx = v[o + 2];
          let vy = v[o + 3];
          const nx = x * FIELD_SCALE;
          const ny = y * FIELD_SCALE;
          const dndx = noise2(nx + CURL_EPS, ny) - noise2(nx - CURL_EPS, ny);
          const dndy = noise2(nx, ny + CURL_EPS) - noise2(nx, ny - CURL_EPS);
          let wx = dndy;
          let wy = -dndx;
          const cl = Math.hypot(wx, wy) || 1;
          const sp = 40 + 50 * hash2(j * 1.31, s * 7.7);
          wx = (wx / cl) * sp * 0.6;
          wy = (wy / cl) * sp * 0.6 - sp * 0.8;
          const mix = Math.min(1, dt * 5);
          vx += (wx - vx) * mix;
          vy += (wy - vy) * mix;
          x += vx * dt;
          y += vy * dt;
          v[o] = x;
          v[o + 1] = y;
          v[o + 2] = vx;
          v[o + 3] = vy;
          ctx.globalAlpha = (1 - age / life) * 0.7;
          ctx.fillRect(x - half, y - half, GRAIN, GRAIN);
          j++;
        }
        if (slot.vc > 0) settled = false;

        if (settled) {
          for (let i = 0; i < slot.gc; i++) {
            const o = i * FLOATS;
            g[o] = g[o + 4];
            g[o + 1] = g[o + 5];
            g[o + 2] = 0;
            g[o + 3] = 0;
          }
          slot.active = false;
        }
      }
      ctx.globalAlpha = 1;
      raf = anyActive ? requestAnimationFrame(loop) : 0;
    };

    const wake = () => {
      if (!raf && ctx) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const transition = (s: number, d: number) => {
      if (!glyphs) return;
      const slot = slots[s];
      const g = slot.g;
      const v = slot.v;
      let vc = 0;
      for (let i = 0; i < slot.gc && vc < MAX_GRAINS; i++) {
        const o = i * FLOATS;
        const vo = vc * FLOATS;
        v[vo] = g[o];
        v[vo + 1] = g[o + 1];
        v[vo + 2] = g[o + 2] * 0.4;
        v[vo + 3] = g[o + 3] * 0.4 - 12;
        v[vo + 4] = 0;
        v[vo + 5] = 700 + Math.random() * 400;
        vc++;
      }
      slot.vc = vc;
      const homes = glyphs[d];
      const cell = cells[s];
      const n = homes.length / 2;
      slot.gc = n;
      for (let i = 0; i < n; i++) {
        const o = i * FLOATS;
        const hx = cell.x + homes[i * 2];
        const hy = cell.y + homes[i * 2 + 1];
        if (vc > 0) {
          const src = ((Math.random() * vc) | 0) * FLOATS;
          g[o] = v[src] + (Math.random() - 0.5) * 10;
          g[o + 1] = v[src + 1] + (Math.random() - 0.5) * 10;
          g[o + 2] = (Math.random() - 0.5) * 40;
          g[o + 3] = -20 - Math.random() * 40;
        } else {
          g[o] = hx;
          g[o + 1] = hy;
          g[o + 2] = 0;
          g[o + 3] = 0;
        }
        g[o + 4] = hx;
        g[o + 5] = hy;
      }
      slot.active = true;
    };

    const init = () => {
      if (!ctx) return;
      const rootRect = root.getBoundingClientRect();
      const w = Math.round(rootRect.width);
      const h = Math.round(rootRect.height);
      if (w < 2 || h < 2) return;
      lastW = w;
      lastH = h;
      cw = w + PAD_X * 2;
      ch = h + PAD_TOP + PAD_BOTTOM;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cells = digitEls.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - rootRect.left + PAD_X, y: r.top - rootRect.top + PAD_TOP };
      });

      // rasterize 0–9 once in the real font (tabular figures: every cell is the same size)
      const cellRect = digitEls[0].getBoundingClientRect();
      const gw = Math.max(2, Math.ceil(cellRect.width));
      const gh = Math.max(2, Math.ceil(cellRect.height));
      const off = document.createElement("canvas");
      off.width = gw;
      off.height = gh;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      const cs = getComputedStyle(digitEls[0]);
      octx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = "#ffffff";
      glyphs = [];
      for (let d = 0; d < 10; d++) {
        octx.clearRect(0, 0, gw, gh);
        octx.fillText(String(d), gw / 2, gh / 2);
        const alpha = octx.getImageData(0, 0, gw, gh).data;
        const pts: number[] = [];
        for (let y = 1; y < gh; y += SAMPLE_STRIDE) {
          const row = y * gw;
          for (let x = 1; x < gw; x += SAMPLE_STRIDE) {
            if (alpha[(row + x) * 4 + 3] > 128) pts.push(x, y);
          }
        }
        const total = pts.length / 2;
        const keepEvery = Math.max(1, Math.ceil(total / MAX_GRAINS));
        const homes = new Float32Array(Math.ceil(total / keepEvery) * 2);
        let n = 0;
        for (let i = 0; i < total; i += keepEvery) {
          homes[n * 2] = pts[i * 2];
          homes[n * 2 + 1] = pts[i * 2 + 1];
          n++;
        }
        glyphs.push(homes.subarray(0, n * 2));
      }

      for (let s = 0; s < DIGITS; s++) {
        const slot = slots[s];
        const homes = glyphs[Number(digits.charAt(s))];
        const cell = cells[s];
        const n = homes.length / 2;
        slot.gc = n;
        slot.vc = 0;
        slot.active = false;
        for (let i = 0; i < n; i++) {
          const o = i * FLOATS;
          const hx = cell.x + homes[i * 2];
          const hy = cell.y + homes[i * 2 + 1];
          slot.g[o] = hx;
          slot.g[o + 1] = hy;
          slot.g[o + 2] = 0;
          slot.g[o + 3] = 0;
          slot.g[o + 4] = hx;
          slot.g[o + 5] = hy;
        }
      }
      wake();
    };

    // tick on each minute boundary (every 4 s in preview)
    const schedule = () => {
      const wait = preview ? 4000 - ((Date.now() - startedAt) % 4000) + 15 : 60_000 - (Date.now() % 60_000) + 50;
      timer = setTimeout(tick, wait);
    };
    const tick = () => {
      const next = toDigits();
      if (next !== digits) {
        for (let s = 0; s < DIGITS; s++) {
          if (next.charAt(s) !== digits.charAt(s)) {
            digitEls[s].textContent = next.charAt(s);
            if (!reduced) transition(s, Number(next.charAt(s)));
          }
        }
        digits = next;
        applyDateTime();
        if (!reduced) wake();
      }
      schedule();
    };

    for (let s = 0; s < DIGITS; s++) digitEls[s].textContent = digits.charAt(s);
    applyDateTime();
    schedule();

    if (reduced || !ctx) {
      return () => {
        disposed = true;
        if (timer) clearTimeout(timer);
      };
    }

    let ro: ResizeObserver | undefined;
    // rasterize only once the font has loaded, or the grains take the fallback font's shape
    document.fonts.ready.then(() => {
      if (disposed) return;
      init();
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const w = Math.round(entry.contentRect.width);
        const h = Math.round(entry.contentRect.height);
        if (w !== lastW || h !== lastH) init();
      });
      ro.observe(root);
    });

    // the TV can come back from sleep: catch up right away instead of waiting a minute
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const digit = "font-semibold leading-none tracking-tight text-foreground opacity-0 tabular-nums motion-reduce:opacity-100";

  return (
    <div ref={rootRef} className={`relative inline-flex items-center select-none ${className}`}>
      <time ref={timeRef} className="inline-flex items-center">
        <span data-vc-digit className={digit}>0</span>
        <span data-vc-digit className={digit}>0</span>
        <span aria-hidden className="mx-[0.06em] -translate-y-[0.06em] font-semibold leading-none text-foreground/70">:</span>
        <span data-vc-digit className={digit}>0</span>
        <span data-vc-digit className={digit}>0</span>
      </time>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute motion-reduce:hidden"
        style={{
          left: -PAD_X,
          top: -PAD_TOP,
          width: `calc(100% + ${PAD_X * 2}px)`,
          height: `calc(100% + ${PAD_TOP + PAD_BOTTOM}px)`,
        }}
      />
    </div>
  );
}

export default VaporClock;
