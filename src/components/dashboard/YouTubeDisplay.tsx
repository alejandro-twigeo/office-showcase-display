import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useYoutubeQueue } from "@/hooks/useYoutubeQueue";
import { Youtube, User, ListMusic } from "lucide-react";
import partitureVideo from "@/assets/partiture.mp4";
import { useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  return (
    <Card className="h-full min-h-0 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[clamp(20px,1.5vw,28px)]">
          <Youtube className="h-[clamp(18px,1.2vw,26px)] w-[clamp(18px,1.2vw,26px)] text-destructive" />
          Now Playing
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        <div className="h-full grid grid-cols-[3fr_1fr] gap-[clamp(8px,0.8vw,16px)]">
          {/* Left — video + info */}
          <div className="min-h-0 flex flex-col">
            {!currentVideo ? (
              <div className="text-center flex-1 flex flex-col items-center justify-center">
                <video src={partitureVideo} autoPlay loop muted playsInline className="h-[clamp(64px,6vw,128px)] w-auto mb-3" />
                <p className="text-muted-foreground text-[clamp(14px,1vw,20px)]">
                  No video playing
                </p>
                <p className="text-muted-foreground text-[clamp(12px,0.8vw,16px)] mt-1">
                  Queue one from the Play page!
                </p>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 gap-[clamp(8px,0.6vw,16px)]">
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
                  <div className="flex items-center gap-2 text-[clamp(13px,0.9vw,18px)] text-muted-foreground">
                    <User className="h-[clamp(14px,0.9vw,18px)] w-[clamp(14px,0.9vw,18px)]" />
                    <span>Queued by {currentVideo.queued_by}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right — queue sidebar */}
          <div className="min-h-0 flex flex-col border-l border-border pl-[clamp(8px,0.8vw,16px)]">
            <h4 className="flex items-center gap-1.5 text-[clamp(14px,1vw,20px)] font-medium mb-2 shrink-0">
              <ListMusic className="h-[clamp(14px,1vw,20px)] w-[clamp(14px,1vw,20px)]" />
              Queue
              {queue.length > 0 && (
                <span className="text-muted-foreground font-normal">({queue.length})</span>
              )}
            </h4>
            <ScrollArea className="flex-1 min-h-0">
              {queue.length === 0 ? (
                <p className="text-muted-foreground text-[clamp(12px,0.8vw,16px)] text-center mt-4">
                  Queue empty
                </p>
              ) : (
                <div className="space-y-[clamp(6px,0.5vw,12px)] pr-2">
                  {queue.map((item, i) => (
                    <div key={item.id} className="flex gap-[clamp(6px,0.5vw,10px)] items-start">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt=""
                          className="w-[clamp(48px,4vw,80px)] aspect-video rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-[clamp(48px,4vw,80px)] aspect-video rounded bg-secondary shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[clamp(12px,0.85vw,16px)] font-medium line-clamp-2 leading-tight">
                          {i + 1}. {item.title}
                        </p>
                        <p className="text-[clamp(10px,0.7vw,13px)] text-muted-foreground mt-0.5">
                          {item.queued_by}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
