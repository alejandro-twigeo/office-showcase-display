import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOfficeActivity, OFFICES } from "@/hooks/useOfficeActivity";

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

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

/** Header cards: one per office with weather (°C and °F), local time, and this week's race points. */
export function OfficeStrip() {
  const a = useOfficeActivity();
  const { data: weather } = useOfficeWeather();
  useMinuteTick();

  return (
    <div className="flex min-w-0 items-stretch justify-center gap-[clamp(8px,0.7vw,14px)]">
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
            className={`flex min-w-0 items-center gap-[clamp(8px,0.7vw,14px)] rounded-[clamp(12px,1vw,20px)] bg-[hsl(var(--card))] px-[clamp(10px,0.9vw,18px)] py-[clamp(6px,0.5vw,10px)] transition-shadow duration-500 ${
              leading ? "shadow-[0_0_0_2px_hsl(var(--primary)/0.5)]" : ""
            }`}
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
              <p className="font-bold tabular-nums text-primary text-[clamp(15px,1.1vw,24px)]">{points}</p>
              <p className="whitespace-nowrap text-muted-foreground text-[clamp(10px,0.68vw,14px)]">{rank > 0 ? `${ordinal(rank)} this week` : "this week"}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
