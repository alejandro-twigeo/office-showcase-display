import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useYoutubeQueue } from "@/hooks/useYoutubeQueue";
import { Youtube, User, Music, ListMusic } from "lucide-react";
import { useMemo, useEffect, useRef, useCallback } from "react";

export function YouTubeDisplay() {
  const { currentVideo, queue, advanceQueue } = useYoutubeQueue();
  const playerRef = useRef<HTMLIFrameElement>(null);
  const hasAdvancedRef = useRef(false);

  // Use a stable key so the iframe fully reloads when the video changes
  const iframeKey = currentVideo?.id ?? "no-video";

  const embedSrc = useMemo(() => {
    if (!currentVideo?.video_id) return "";
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "0",
      controls: "1",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      enablejsapi: "1",
      // origin is required for postMessage events to work
      origin: window.location.origin,
    });
    return `https://www.youtube.com/embed/${currentVideo.video_id}?${params.toString()}`;
  }, [currentVideo?.video_id]);

  // Reset advance guard when video changes
  useEffect(() => {
    hasAdvancedRef.current = false;
  }, [currentVideo?.id]);

  // Handle YouTube postMessage events to detect video end
  const handleVideoEnd = useCallback(() => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    advanceQueue.mutate(currentVideo?.id);
  }, [advanceQueue, currentVideo?.id]);

  // Send the "listening" registration to the iframe so YouTube
  // starts emitting postMessage state-change events
  const sendListening = useCallback(() => {
    const iframe = playerRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "listening" }),
      "https://www.youtube.com"
    );
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        // Once the player is ready, register as a listener so it keeps sending events
        if (data?.event === "onReady") {
          sendListening();
        }
        // onStateChange info=0 means video ended
        if (data?.event === "onStateChange" && data?.info === 0) {
          handleVideoEnd();
        }
      } catch {
        // ignore parse errors
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [handleVideoEnd, sendListening]);

  const nextInQueue = queue[0];

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[clamp(20px,1.5vw,28px)]">
          <Youtube className="h-[clamp(18px,1.2vw,26px)] w-[clamp(18px,1.2vw,26px)] text-destructive" />
          Now Playing
          {queue.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[clamp(12px,0.85vw,18px)] text-muted-foreground font-normal">
              <ListMusic className="h-[clamp(12px,0.85vw,18px)] w-[clamp(12px,0.85vw,18px)]" />
              {queue.length} in queue
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 flex flex-col">
        {!currentVideo ? (
          <div className="text-center flex-1 flex flex-col items-center justify-center">
            <Music className="h-[clamp(32px,3vw,64px)] w-[clamp(32px,3vw,64px)] text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-[clamp(14px,1vw,20px)]">
              No video playing
            </p>
            <p className="text-muted-foreground text-[clamp(12px,0.8vw,16px)] mt-1">
              Queue one from the Play page!
            </p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-[clamp(8px,0.6vw,16px)]">
            <div className="flex-1 min-h-0 bg-secondary rounded-lg overflow-hidden">
              <iframe
                ref={playerRef}
                key={iframeKey}
                width="100%"
                height="100%"
                src={embedSrc}
                title={currentVideo.title || "YouTube video"}
                frameBorder="0"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                onLoad={sendListening}
              />
            </div>

            <div className="space-y-1">
              <h4 className="font-medium line-clamp-1 text-[clamp(16px,1.2vw,24px)]">
                {currentVideo.title}
              </h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[clamp(13px,0.9vw,18px)] text-muted-foreground">
                  <User className="h-[clamp(14px,0.9vw,18px)] w-[clamp(14px,0.9vw,18px)]" />
                  <span>Queued by {currentVideo.queued_by}</span>
                </div>
                {nextInQueue && (
                  <div className="flex items-center gap-1 text-[clamp(11px,0.75vw,15px)] text-muted-foreground">
                    <span>Up next:</span>
                    <span className="line-clamp-1 max-w-[clamp(80px,8vw,160px)]">{nextInQueue.title}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
