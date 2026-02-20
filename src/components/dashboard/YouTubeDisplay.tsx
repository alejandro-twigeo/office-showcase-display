import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useYoutubeQueue } from "@/hooks/useYoutubeQueue";
import { Youtube, User, Music, ListMusic } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";

/* ── YouTube IFrame API bootstrap ───────────────────────────────────────── */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

type YTPlayer = {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  setSize: (width: number, height: number) => void;
  destroy: () => void;
};

const ytAPIReadyCallbacks: Array<() => void> = [];
let ytAPILoaded = false;

function loadYouTubeAPI(onReady: () => void) {
  ytAPIReadyCallbacks.push(onReady);

  if (ytAPILoaded) return;
  ytAPILoaded = true;

  if (window.YT?.Player) {
    // Already available
    ytAPIReadyCallbacks.forEach((cb) => cb());
    ytAPIReadyCallbacks.length = 0;
    return;
  }

  window.onYouTubeIframeAPIReady = () => {
    ytAPIReadyCallbacks.forEach((cb) => cb());
    ytAPIReadyCallbacks.length = 0;
  };

  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(script);
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function YouTubeDisplay() {
  const { currentVideo, queue, advanceQueue } = useYoutubeQueue();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const playerReadyRef = useRef(false);
  const hasAdvancedRef = useRef(false);
  const currentVideoIdRef = useRef<string | undefined>(undefined);
  const pendingVideoIdRef = useRef<string | undefined>(undefined);

  const handleVideoEnd = useCallback(() => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    advanceQueue.mutate(currentVideoIdRef.current);
  }, [advanceQueue]);

  // Keep currentVideoIdRef in sync so the stale-closure-safe callback always has the latest id
  useEffect(() => {
    currentVideoIdRef.current = currentVideo?.id;
    hasAdvancedRef.current = false;
  }, [currentVideo?.id]);

  // Bootstrap / manage the YT.Player instance
  useEffect(() => {
    if (!currentVideo?.video_id) {
      playerRef.current?.destroy();
      playerRef.current = null;
      playerReadyRef.current = false;
      return;
    }

    const videoId = currentVideo.video_id;

    const initPlayer = () => {
      if (!containerRef.current) return;

      // Reuse existing player only if it's fully ready
      if (playerRef.current && playerReadyRef.current) {
        playerRef.current.loadVideoById(videoId);
        // Explicitly call playVideo in case autoplay is blocked
        setTimeout(() => playerRef.current?.playVideo(), 300);
        return;
      }

      // If player exists but not ready yet, just store pending video id
      if (playerRef.current && !playerReadyRef.current) {
        pendingVideoIdRef.current = videoId;
        return;
      }

      // Create a fresh div for YT to replace with iframe
      const div = document.createElement("div");
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(div);

      pendingVideoIdRef.current = undefined;
      playerReadyRef.current = false;

      const w = containerRef.current.offsetWidth || 1280;
      const h = containerRef.current.offsetHeight || 720;

      playerRef.current = new window.YT.Player(div, {
        width: w,
        height: h,
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            // Explicitly start playback — autoplay param is often blocked by browser policy
            playerRef.current?.playVideo();
            // If a new video was requested while player was initializing, load it now
            if (pendingVideoIdRef.current && pendingVideoIdRef.current !== videoId) {
              playerRef.current?.loadVideoById(pendingVideoIdRef.current);
              setTimeout(() => playerRef.current?.playVideo(), 300);
              pendingVideoIdRef.current = undefined;
            }
          },
          onStateChange: (event: { data: number }) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0) {
              handleVideoEnd();
            }
          },
        },
      });
    };

    loadYouTubeAPI(initPlayer);

    // If YT is already ready, init immediately
    if (window.YT?.Player) {
      initPlayer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.video_id]);

  // ResizeObserver — keep player sized to its container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!containerRef.current || !playerRef.current) return;
      const { offsetWidth: w, offsetHeight: h } = containerRef.current;
      if (w && h) playerRef.current.setSize(w, h);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      playerReadyRef.current = false;
    };
  }, []);

  const nextInQueue = queue[0];

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[clamp(20px,1.5vw,28px)]">
          <Youtube className="h-[clamp(18px,1.2vw,26px)] w-[clamp(18px,1.2vw,26px)] text-destructive" />
          Now Playing
          {queue.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[clamp(14px,1.1vw,24px)] text-muted-foreground font-normal">
              <ListMusic className="h-[clamp(14px,1.1vw,24px)] w-[clamp(14px,1.1vw,24px)]" />
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
            {/* YT.Player mounts here — absolute positioning gives the iframe a concrete bounding box */}
            <div className="flex-1 min-h-0 relative">
              <div
                ref={containerRef}
                className="absolute inset-0 bg-secondary rounded-lg overflow-hidden"
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
                  <div className="flex items-center gap-1 text-[clamp(13px,1vw,20px)] text-muted-foreground">
                    <span>Up next:</span>
                    <span className="line-clamp-1 max-w-[clamp(100px,12vw,240px)]">{nextInQueue.title}</span>
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
