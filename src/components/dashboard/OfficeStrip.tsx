import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HandCircle } from "@/components/Squiggles";
import { useQuery } from "@tanstack/react-query";
import { useOfficeActivity, OFFICES } from "@/hooks/useOfficeActivity";
import { CountUp } from "@/components/ui/count-up";

/** Where each office is, for weather and local time */
const OFFICE_PLACES: Record<string, { lat: number; lon: number; tz: string }> = {
  Sweden: { lat: 59.33, lon: 18.07, tz: "Europe/Stockholm" },
  US: { lat: 40.71, lon: -74.01, tz: "America/New_York" },
  Bulgaria: { lat: 43.21, lon: 27.91, tz: "Europe/Sofia" },
};
const ORDER = ["Sweden", "US", "Bulgaria"];

/** WMO weather code → emoji (open-meteo) */
function weatherEmoji(code?: number) {
  if (code === undefined) return "";
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67 || (code >= 80 && code <= 82)) return "🌧️";
  if (code <= 77 || code === 85 || code === 86) return "🌨️";
  return "⛈️";
}

/** Current temperature and conditions for the three offices. Free API, no key; refreshed every 30 minutes. */
function useOfficeWeather() {
  return useQuery({
    queryKey: ["office-weather"],
    refetchInterval: 30 * 60_000,
    staleTime: 25 * 60_000,
    queryFn: async () => {
      const lat = ORDER.map((o) => OFFICE_PLACES[o].lat).join(",");
      const lon = ORDER.map((o) => OFFICE_PLACES[o].lon).join(",");
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
      if (!res.ok) throw new Error("weather");
      const json = await res.json();
      const list = Array.isArray(json) ? json : [json];
      return Object.fromEntries(
        ORDER.map((o, i) => [o, { temp: list[i]?.current?.temperature_2m as number | undefined, code: list[i]?.current?.weather_code as number | undefined }])
      );
    },
  });
}

function useMinuteTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
}

/** Gold, silver, bronze: the disc's glow, the ribbon's top and bottom colours, and the shadow tint */
const METALS = [
  { glow: "46 96% 60%", top: "44 96% 56%", bottom: "32 100% 52%", shadow: "36 90% 40%" },
  { glow: "215 16% 74%", top: "214 18% 80%", bottom: "218 14% 58%", shadow: "218 20% 35%" },
  { glow: "26 72% 62%", top: "27 68% 58%", bottom: "18 62% 42%", shadow: "20 60% 30%" },
];
const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

/**
 * A glass medal: a frosted disc with a white star and a glow in the metal's colour, on a ribbon.
 * rank 1 = gold, 2 = silver, 3 = bronze.
 */
function GlassMedal({ rank }: { rank: number }) {
  const m = METALS[rank - 1];
  const id = `medal-ribbon-${rank}`;
  return (
    <span className="relative block aspect-[1/1.32] w-[clamp(24px,2vw,42px)]">
      {/* soft glow behind everything */}
      <span
        aria-hidden
        className="absolute -inset-[35%] blur-[8px]"
        style={{ background: `radial-gradient(closest-side, hsl(${m.glow} / 0.5), transparent)` }}
      />
      {/* ribbon: starts behind the disc, so its top is frosted by the glass */}
      <svg aria-hidden viewBox="0 0 40 46" className="absolute left-1/2 top-[40%] w-[58%] -translate-x-1/2 overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`hsl(${m.top})`} />
            <stop offset="1" stopColor={`hsl(${m.bottom})`} />
          </linearGradient>
        </defs>
        <path d="M3 0h34a3 3 0 0 1 3 3v40.5a2 2 0 0 1-3.4 1.4L21.4 29.6a2 2 0 0 0-2.8 0L3.4 44.9A2 2 0 0 1 0 43.5V3a3 3 0 0 1 3-3Z" fill={`url(#${id})`} />
      </svg>
      {/* the glass disc */}
      <span
        className="absolute inset-x-0 top-0 flex aspect-square items-center justify-center rounded-full border border-white/70 [-webkit-backdrop-filter:blur(6px)] [backdrop-filter:blur(6px)]"
        style={{
          background: `radial-gradient(120% 90% at 50% 100%, hsl(${m.glow} / 0.8), hsl(${m.glow} / 0.28) 52%, hsl(0 0% 100% / 0.55) 80%), hsl(0 0% 100% / 0.35)`,
          boxShadow: `inset 0 1px 1px hsl(0 0% 100% / 0.9), 0 6px 14px -6px hsl(${m.shadow} / 0.45)`,
        }}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="w-[46%] -translate-y-[10%]" style={{ filter: `drop-shadow(0 1px 1px hsl(${m.shadow} / 0.35))` }}>
          <path
            d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1L3.2 9.2l6.1-.8L12 2.8Z"
            fill="white"
            stroke="white"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </span>
  );
}

// When an office overtakes another, the medals glide over to their new owners with a small overshoot
const MEDAL_MOVE = "transform 900ms cubic-bezier(0.34, 1.25, 0.64, 1)";

/** Header cards: one per office with weather (°C and °F), local time, and this week's race points, with a gold, silver or bronze medal for the top three. */
export function OfficeStrip() {
  const a = useOfficeActivity();
  const { data: weather } = useOfficeWeather();
  useMinuteTick();

  // Medals live in one layer over the cards, one per rank, so a medal can move from one office to another.
  // Each card has an empty slot under its points; the medal of that office's rank sits on that slot.
  const wrap = useRef<HTMLDivElement>(null);
  const slots = useRef<Record<string, HTMLSpanElement | null>>({});
  const [spots, setSpots] = useState<Record<string, { x: number; y: number }>>({});
  const [animate, setAnimate] = useState(false); // no gliding in from the corner on first paint
  const measure = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const next: Record<string, { x: number; y: number }> = {};
    for (const o of ORDER) {
      const r = slots.current[o]?.getBoundingClientRect();
      if (r) next[o] = { x: r.left + r.width / 2 - box.left, y: r.top - box.top };
    }
    setSpots(next);
  }, []);
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) {
      ro.observe(wrap.current);
      // the cards change width when the weather loads, which moves the slots
      for (const card of Array.from(wrap.current.children)) ro.observe(card);
    }
    const t = setTimeout(() => setAnimate(true), 100);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [measure]);
  // Offices that have points, in order: index 0 gets gold, 1 silver, 2 bronze
  const ranked = a.officePoints.filter((o) => o.points > 0).slice(0, 3);
  const rankKey = ranked.map((o) => o.office).join("|");
  useLayoutEffect(measure, [rankKey, measure]);

  return (
    <div ref={wrap} className="relative flex min-w-0 items-stretch justify-center gap-[clamp(8px,0.7vw,14px)]">
      {ORDER.map((office) => {
        const info = OFFICES[office];
        const place = OFFICE_PLACES[office];
        const w = weather?.[office];
        const rank = a.officePoints.findIndex((o) => o.office === office) + 1;
        const points = a.officePoints.find((o) => o.office === office)?.points ?? 0;
        const leading = rank === 1 && points > 0;
        const time = new Intl.DateTimeFormat("en-GB", { timeZone: place.tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
        const c = w?.temp !== undefined ? Math.round(w.temp) : null;
        const f = w?.temp !== undefined ? Math.round(w.temp * 1.8 + 32) : null;
        return (
          <div
            key={office}
            className="glass flex min-w-0 items-center gap-[clamp(8px,0.7vw,14px)] rounded-[clamp(12px,1vw,20px)] bg-[hsl(var(--card))] px-[clamp(10px,0.9vw,18px)] py-[clamp(6px,0.5vw,10px)]"
          >
            <span className="leading-none text-[clamp(20px,1.6vw,34px)]">{info.flag}</span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-semibold text-[clamp(14px,1.05vw,22px)]">{info.city}</p>
              <p className="truncate text-muted-foreground tabular-nums text-[clamp(11px,0.8vw,17px)]">
                {c !== null ? `${c}°C · ${f}°F ${weatherEmoji(w?.code)} · ` : ""}
                {time}
              </p>
            </div>
            <div className="ml-[clamp(4px,0.4vw,8px)] text-right leading-tight">
              <p className="font-bold tabular-nums text-primary text-[clamp(15px,1.1vw,24px)]">
                {/* The leading office gets a hand-drawn ring around its points */}
                <span className="relative inline-block">
                  <CountUp value={points} />
                  {leading && <HandCircle key={office} className="absolute -left-[45%] -top-[38%] h-[176%] w-[190%]" />}
                </span>
              </p>
              {/* Where the medal sits: it starts here and hangs over the card's bottom edge */}
              <span ref={(el) => (slots.current[office] = el)} className="block h-[clamp(10px,0.68vw,14px)]" />
            </div>
          </div>
        );
      })}

      {/* The medals: gold, silver and bronze, each placed on the slot of the office that holds that rank */}
      {ranked.map(({ office }, i) => {
        const spot = spots[office];
        if (!spot) return null;
        return (
          <span
            key={i}
            role="img"
            aria-label={`${OFFICES[office].city}: ${ordinal(i + 1)} this week`}
            className="pointer-events-none absolute left-0 top-0 z-10"
            style={{
              transform: `translate(${spot.x}px, ${spot.y}px) translateX(-50%)`,
              transition: animate ? MEDAL_MOVE : "none",
            }}
          >
            <span className="block animate-in fade-in zoom-in-75 duration-700">
              <GlassMedal rank={i + 1} />
            </span>
          </span>
        );
      })}
    </div>
  );
}
