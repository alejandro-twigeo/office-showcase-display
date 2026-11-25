import { useEffect, useState } from "react";

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** Office clock for the TV header. Ticks on the minute so it never drifts. */
export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timer = setTimeout(tick, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()));
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="shrink-0 flex items-baseline gap-[clamp(8px,0.8vw,16px)]">
      <time
        dateTime={now.toISOString()}
        className="font-semibold tabular-nums tracking-tight text-foreground leading-none text-[clamp(28px,2.6vw,56px)]"
      >
        {timeFmt.format(now)}
      </time>
      <span className="text-muted-foreground leading-none text-[clamp(13px,1vw,20px)]">{dateFmt.format(now)}</span>
    </div>
  );
}
