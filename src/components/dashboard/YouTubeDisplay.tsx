import { Card } from "@/components/ui/card";
import { useYoutubeQueue } from "@/hooks/useYoutubeQueue";
import { ListMusic, Volume2 } from "lucide-react";
import partitureVideo from "@/assets/partiture.mp4";
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ── YouTube IFrame API bootstrap ───────────────────────────────────────── */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

type YTPlayer = {
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setSize: (width: number, height: number) => void;
  destroy: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ytQueue = () => (supabase as any).from("youtube_queue");

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
  // True when the TV browser refused to autoplay with sound and we fell back to muted
  const [soundBlocked, setSoundBlocked] = useState(false);

  // TV browsers often block autoplay with sound when nobody has clicked the page.
  // If playback hasn't started shortly after we ask, retry muted so the video at least runs.
  const ensurePlaying = useCallback(() => {
    setTimeout(() => {
      const p = playerRef.current;
      if (!p || !playerReadyRef.current) return;
      const state = p.getPlayerState(); // 1 = playing, 3 = buffering
      if (state !== 1 && state !== 3) {
        p.mute();
        p.playVideo();
        setSoundBlocked(true);
      }
    }, 2500);
  }, []);

  const enableSound = useCallback(() => {
    playerRef.current?.unMute();
    playerRef.current?.playVideo();
    setSoundBlocked(false);
  }, []);

  // Briefly spotlight a video when someone adds it to the queue
  const [spotlight, setSpotlight] = useState<(typeof queue)[number] | null>(null);
  const seenQueueIdsRef = useRef(new Set<string>());
  const mountedAtRef = useRef(Date.now());
  const spotlightTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const seen = seenQueueIdsRef.current;
    const added = [...queue].reverse().find((q) => !seen.has(q.id));
    queue.forEach((q) => seen.add(q.id)); // only ever grows, so refetch blips don't count as new
    // Whatever is in the queue when the TV loads isn't "just added"
    if (!added || Date.now() - mountedAtRef.current < 8000) return;
    setSpotlight(added);
    clearTimeout(spotlightTimerRef.current);
    spotlightTimerRef.current = setTimeout(() => setSpotlight(null), 10_000);
  }, [queue]);
  useEffect(() => () => clearTimeout(spotlightTimerRef.current), []);
  const sidebarWidth = queue.length === 0 ? "0px" : spotlight ? "clamp(180px,12vw,270px)" : "clamp(64px,5vw,110px)";

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

  // Track the video id that is actually loaded in the player to avoid
  // re-initialising when a realtime refetch briefly nulls and restores the
  // same currentVideo object.
  const activeVideoIdRef = useRef<string | undefined>(undefined);

  // Bootstrap / manage the YT.Player instance
  useEffect(() => {
    const videoId = currentVideo?.video_id;

    // Nothing to play — tear down only if we had something before
    if (!videoId) {
      if (activeVideoIdRef.current) {
        playerRef.current?.destroy();
        playerRef.current = null;
        playerReadyRef.current = false;
        activeVideoIdRef.current = undefined;
      }
      return;
    }

    // Same video already loaded — skip (prevents restart on refetch)
    if (videoId === activeVideoIdRef.current && playerRef.current) return;

    activeVideoIdRef.current = videoId;
    const resumeAt = currentVideo!.current_time_seconds ?? 0;

    const initPlayer = () => {
      if (!containerRef.current) return;

      // Reuse existing player only if it's fully ready
      if (playerRef.current && playerReadyRef.current) {
        playerRef.current.loadVideoById(videoId, resumeAt);
        // Explicitly call playVideo in case autoplay is blocked
        setTimeout(() => playerRef.current?.playVideo(), 300);
        ensurePlaying();
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
          start: resumeAt,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            // Explicitly start playback — autoplay param is often blocked by browser policy
            playerRef.current?.playVideo();
            ensurePlaying();
            // If a new video was requested while player was initializing, load it now
            if (pendingVideoIdRef.current && pendingVideoIdRef.current !== videoId) {
              playerRef.current?.loadVideoById(pendingVideoIdRef.current);
              setTimeout(() => playerRef.current?.playVideo(), 300);
              pendingVideoIdRef.current = undefined;
            }
          },
          // Video removed, private or not embeddable: skip it instead of stalling the queue
          onError: () => {
            handleVideoEnd();
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

  // Periodically persist playback position (every 5s)
  useEffect(() => {
    if (!currentVideo?.id) return;
    const id = currentVideo.id;
    const interval = setInterval(async () => {
      if (!playerRef.current || !playerReadyRef.current) return;
      try {
        const seconds = Math.floor(playerRef.current.getCurrentTime());
        await ytQueue().update({ current_time_seconds: seconds }).eq("id", id);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [currentVideo?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      playerReadyRef.current = false;
    };
  }, []);

  return (
    <Card className="h-full min-h-0 flex flex-col p-[clamp(14px,1.3vw,28px)] gap-[clamp(10px,0.9vw,18px)]">
      <span className="tile-label">Now playing</span>

      <div className="flex-1 min-h-0">
        <div
          className="h-full flex flex-col lg:grid gap-2 lg:gap-[clamp(8px,0.8vw,16px)] transition-[grid-template-columns] duration-500 ease-out"
          style={{ gridTemplateColumns: `minmax(0,1fr) ${sidebarWidth}` }}
        >
          {/* Left — video + info */}
          <div className="min-h-0 flex flex-col">
            {!currentVideo ? (
              <div className="text-center flex-1 flex flex-col items-center justify-center">
                <video src={partitureVideo} autoPlay loop muted playsInline className="h-16 lg:h-[clamp(128px,12vw,256px)] w-auto mb-2 lg:mb-3" />
                <p className="text-muted-foreground text-xs lg:text-[clamp(14px,1vw,20px)]">
                  No video playing
                </p>
                <p className="text-muted-foreground text-[10px] lg:text-[clamp(12px,0.8vw,16px)] mt-0.5 lg:mt-1">
                  Queue one from the Play page!
                </p>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 gap-1 lg:gap-[clamp(8px,0.6vw,16px)]">
                <div className="flex-1 min-h-0 relative">
                  <div
                    ref={containerRef}
                    className="absolute inset-0 bg-secondary rounded-[clamp(10px,0.9vw,18px)] overflow-hidden"
                  />
                  {soundBlocked && (
                    <button
                      onClick={enableSound}
                      className="absolute bottom-[clamp(8px,0.8vw,16px)] left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-primary px-[clamp(14px,1.2vw,24px)] py-[clamp(8px,0.6vw,12px)] text-primary-foreground font-semibold text-sm lg:text-[clamp(14px,1vw,20px)] shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Volume2 className="h-4 w-4 lg:h-[clamp(16px,1.2vw,24px)] lg:w-[clamp(16px,1.2vw,24px)]" />
                      Turn sound on
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-semibold tracking-tight line-clamp-1 text-sm lg:text-[clamp(17px,1.3vw,28px)]">
                    {currentVideo.title}
                  </h4>
                  {currentVideo.channel_title && (
                    <p className="text-xs lg:text-[clamp(12px,0.85vw,16px)] text-muted-foreground line-clamp-1">
                      {currentVideo.channel_title}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right — queue. Hidden when empty, big for a moment when someone adds a video, then a slim thumbnail strip */}
          {queue.length > 0 && (
            <div className="flex lg:hidden items-center gap-2 text-xs text-muted-foreground border-t border-border pt-1.5">
              <ListMusic className="h-3.5 w-3.5" />
              <span>{queue.length} in queue</span>
              <span className="truncate">— Next: {queue[0]?.title}</span>
            </div>
          )}
          <div
            className="hidden lg:flex min-h-0 flex-col overflow-hidden transition-opacity duration-500"
            style={{ opacity: queue.length ? 1 : 0 }}
          >
            {spotlight ? (
              <div
                key={spotlight.id}
                className="flex h-full min-h-0 flex-col gap-[clamp(6px,0.5vw,10px)] rounded-[clamp(8px,0.6vw,12px)] bg-primary/10 p-[clamp(8px,0.7vw,14px)] animate-in fade-in slide-in-from-right-4 duration-500"
              >
                <span className="font-semibold text-primary text-[clamp(12px,0.85vw,18px)]">Just added</span>
                {spotlight.thumbnail_url ? (
                  <img src={spotlight.thumbnail_url} alt="" className="w-full aspect-video rounded-[clamp(6px,0.5vw,10px)] object-cover" />
                ) : (
                  <div className="w-full aspect-video rounded-[clamp(6px,0.5vw,10px)] bg-secondary" />
                )}
                <p className="font-semibold leading-snug line-clamp-2 text-[clamp(13px,0.95vw,20px)]">{spotlight.title}</p>
                <p className="text-muted-foreground text-[clamp(12px,0.8vw,17px)]">by {spotlight.queued_by}</p>
                {queue.length > 1 && (
                  <p className="mt-auto text-muted-foreground text-[clamp(11px,0.75vw,16px)]">{queue.length} in the queue</p>
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col gap-[clamp(6px,0.5vw,10px)]">
                <span className="flex items-center gap-1 text-muted-foreground text-[clamp(11px,0.75vw,16px)] font-medium">
                  <ListMusic className="h-[clamp(12px,0.85vw,18px)] w-[clamp(12px,0.85vw,18px)]" />
                  {queue.length}
                </span>
                {queue.slice(0, 4).map((item) =>
                  item.thumbnail_url ? (
                    <img key={item.id} src={item.thumbnail_url} alt={item.title} title={item.title} className="w-full aspect-video rounded-[clamp(4px,0.4vw,8px)] object-cover" />
                  ) : (
                    <div key={item.id} className="w-full aspect-video rounded-[clamp(4px,0.4vw,8px)] bg-secondary" />
                  )
                )}
                {queue.length > 4 && (
                  <span className="text-center text-muted-foreground text-[clamp(11px,0.75vw,16px)]">+{queue.length - 4}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
