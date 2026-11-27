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
    // A frosted glass pill like the office cards. The digits are a soft, slightly see-through ink with a
    // light top edge, so they read as etched into the glass; the vapor grains pick up the same ink.
    <div className="glass shrink-0 flex items-center gap-[clamp(8px,0.75vw,16px)] rounded-[clamp(12px,1vw,20px)] bg-[hsl(var(--card))] px-[clamp(12px,1vw,20px)] py-[clamp(6px,0.5vw,10px)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.75),0_10px_30px_-18px_hsl(var(--foreground)/0.35)]">
      <VaporClock className="text-[clamp(26px,2.3vw,50px)] [text-shadow:0_1px_0_hsl(0_0%_100%/0.8),0_6px_18px_hsl(var(--foreground)/0.12)] [&_[data-vc-digit]]:text-[hsl(var(--foreground)/0.72)] [&_time>span[aria-hidden]]:text-[hsl(var(--foreground)/0.4)]" />
      <span className="border-l border-foreground/10 pl-[clamp(8px,0.75vw,16px)] text-muted-foreground leading-tight text-[clamp(13px,0.95vw,20px)]">
        {dateFmt.format(now)}
      </span>
    </div>
  );
}
