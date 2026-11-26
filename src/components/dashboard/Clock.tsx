import { useEffect, useState } from "react";
import { VaporClock } from "@/components/ui/vapor-clock";

// Short date next to the clock: "Thu 26"
const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" });

/**
 * Office clock for the TV header. The time is the vapor clock (each minute the changing digits
 * dissolve and re-form); the date ticks on the minute so it never drifts.
 */
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
    <div className="shrink-0 flex items-center gap-[clamp(8px,0.8vw,16px)]">
      <VaporClock className="text-[clamp(32px,3vw,66px)]" />
      <span className="text-muted-foreground leading-tight text-[clamp(13px,1vw,20px)]">{dateFmt.format(now)}</span>
    </div>
  );
}
