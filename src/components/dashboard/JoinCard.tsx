/** Link to the phone play page, built from wherever the TV is running. */
function playUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#/play`;
}

/** The QR code on its own, for smaller spots on the TV. */
export function PlayQr({ className = "" }: { className?: string }) {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=0&color=1a1d23&data=${encodeURIComponent(playUrl())}`}
      alt="QR code to open the play page on your phone"
      className={`block ${className}`}
    />
  );
}

/**
 * Shown on the TV when there is no GeoGuessr round to display.
 * Turns an empty tile into a way in: scan, play, land on the leaderboard.
 */
export function JoinCard() {
  return (
    <div className="flex-1 min-h-0 flex items-center gap-[clamp(16px,1.6vw,32px)] px-[clamp(16px,1.6vw,32px)]">
      <div className="shrink-0 rounded-[clamp(10px,0.8vw,16px)] bg-primary p-[clamp(8px,0.6vw,12px)]">
        <div className="rounded-[clamp(6px,0.5vw,10px)] bg-white p-[clamp(6px,0.5vw,10px)]">
          <PlayQr className="h-[clamp(96px,9vw,190px)] w-[clamp(96px,9vw,190px)]" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-semibold leading-[1.05] tracking-tight text-foreground text-[clamp(22px,2.1vw,44px)]">
          Scan to play
        </p>
        <p className="mt-[clamp(6px,0.5vw,10px)] text-muted-foreground leading-snug text-[clamp(13px,0.95vw,20px)] max-w-[22ch]">
          Wordle, GeoGuessr and six more games on your phone. Your score shows up here.
        </p>
      </div>
    </div>
  );
}
