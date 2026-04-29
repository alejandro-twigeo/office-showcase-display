import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useFlowTvCatalog } from "@/hooks/useFlowTvCatalog";
import { FLOW_FALLBACK_CHANNEL, getFlowChannelUrl } from "@/lib/flowChannels";

const FLOW_ROTATE_SECONDS = 15;

export function FlowDisplay({ fullscreen = false }: { fullscreen?: boolean }) {
  const { data: channels = [], isLoading } = useFlowTvCatalog();
  const [channelIndex, setChannelIndex] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setChannelIndex(0);
    setRefreshNonce(0);
  }, [channels]);

  useEffect(() => {
    if (channels.length === 0) return;
    const timer = window.setInterval(() => {
      setChannelIndex((current) => (current + 1) % channels.length);
      setRefreshNonce((current) => current + 1);
    }, FLOW_ROTATE_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [channels]);

  const activeChannel = useMemo(
    () => channels[channelIndex] ?? null,
    [channels, channelIndex]
  );

  if (isLoading) {
    return <div className="flex h-full items-center justify-center bg-black text-sm text-white/70">Loading Fan TV…</div>;
  }

  const iframeSrc = activeChannel
    ? `${getFlowChannelUrl(activeChannel.id)}&refresh=${refreshNonce}`
    : `${FLOW_FALLBACK_CHANNEL.url}&refresh=${refreshNonce}`;
  const iframeScale = fullscreen ? 1.9 : 1.45;
  const iframeWidth = `${iframeScale * 100}%`;
  const iframeHeight = `${iframeScale * 100}%`;
  const shiftX = fullscreen ? -24 : -14;
  const shiftY = fullscreen ? -18 : -10;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
        <Sparkles className="h-3.5 w-3.5 text-orange-400" />
        Flow TV
      </div>
      <iframe
        title="Google Flow live creations"
        key={`${activeChannel?.id ?? FLOW_FALLBACK_CHANNEL.id}-${refreshNonce}`}
        src={iframeSrc}
        className="border-0"
        style={{
          width: iframeWidth,
          height: iframeHeight,
          transform: `translate(${shiftX}%, ${shiftY}%) scale(1)`,
          transformOrigin: "top left",
        }}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
