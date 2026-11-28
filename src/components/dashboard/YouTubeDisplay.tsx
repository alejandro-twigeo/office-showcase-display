import { Card } from "@/components/ui/card";
import { useYoutubeQueue } from "@/hooks/useYoutubeQueue";
import { ListMusic, Volume2, SkipForward, Loader2 } from "lucide-react";
import partitureVideo from "@/assets/partiture.mp4";
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSpotlight, GameDemoOverlay } from "./GameSpotlight";
import { parseQueuedBy } from "@/lib/dedication";
import { useNavigate } from "react-router-dom";
import { ACTIONABLE, useMe } from "@/hooks/useMe";
import { QueueAdder } from "./QueueAdder";
import { QueueStrip } from "./QueueStrip";
import { NowPlayingIcon } from "./NowPlayingIcon";

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

// The TV isn't logged in, so it only changes the queue through two database functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tvRpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);

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

/* ── Component ────────────────────────────────────────────────────────────────────── */

export function YouTubeDisplay({ onPlayingChange }: { onPlayingChange?: (playing: boolean) => void } = {}) {
  const { currentVideo, queue, addToQueue, reorderQueue } = useYoutubeQueue();
  const me = useMe();
  // Lets the layout give Now playing more room while something is actually playing
  useEffect(() => {
    onPlayingChange?.(!!currentVideo);
  }, [currentVideo, onPlayingChange]);
  const gameSpotlight = useSpotlight();
  const navigate = useNavigate();
  const openMusic = () => navigate("/play?tab=music");
  const addSong = (videoId: string) => me && addToQueue.mutate({ video_id: videoId, queued_by: me });

  // ⏭ Next: skip the song for everyone. Two clicks (the first asks "Skip?"), so nobody skips by accident.
  // Same database step the TV uses when a song ends. Not logged in on this laptop: it opens the Play page.
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [skipping, setSkipping] = useState(false);
  useEffect(() => {
    if (!confirmSkip) return;
    const t = setTimeout(() => setConfirmSkip(false), 3000);
    return () => clearTimeout(t);
  }, [confirmSkip]);
  useEffect(() => setConfirmSkip(false), [currentVideo?.id]);
  const skip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!me) return openMusic();
    if (!currentVideo || skipping) return;
    if (!confirmSkip) return setConfirmSkip(true);
    setConfirmSkip(false);
    setSkipping(true);
    await tvRpc("tv_advance_queue", { p_current: currentVideo.id });
    setSkipping(false);
  };
  // A short note over the video: why a drag didn't work, or that a new order couldn't be saved
  const [queueNote, setQueueNote] = useState<"login" | "failed" | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>();
  const showNote = (n: "login" | "failed") => {
    setQueueNote(n);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setQueueNote(null), 4000);
  };
  useEffect(() => () => clearTimeout(noteTimer.current), []);
  const skipIcon = skipping ? <Loader2 className="h-[55%] w-auto animate-spin" /> : <SkipForward className="h-[50%] w-auto shrink-0 fill-current" />;
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

  // Next song: the TV isn't logged in, so it uses the database function made for exactly this.
  // The queue updates itself through realtime afterwards.
  const handleVideoEnd = useCallback(() => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    tvRpc("tv_advance_queue", { p_current: currentVideoIdRef.current ?? null });
  }, []);

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

  // Keep the player the size of its box. The box only exists while a video plays (and the tile
  // grows when one starts), so this is set up whenever a video appears, not just on first load.
  useEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    const fit = () => {
      const { offsetWidth: w, offsetHeight: h } = box;
      if (w && h && playerRef.current && playerReadyRef.current) playerRef.current.setSize(w, h);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    // the tile's grow animation takes ~0.7 s; fit once more when it has settled
    const t = setTimeout(fit, 900);
    return () => {
      observer.disconnect();
      clearTimeout(t);
    };
  }, [currentVideo?.id]);

  // Periodically persist playback position (every 5s)
  useEffect(() => {
    if (!currentVideo?.id) return;
    const id = currentVideo.id;
    const interval = setInterval(async () => {
      if (!playerRef.current || !playerReadyRef.current) return;
      try {
        const seconds = Math.floor(playerRef.current.getCurrentTime());
        // only saves the position of the video that is playing
        await tvRpc("tv_save_position", { p_id: id, p_seconds: seconds });
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
    <Card className="relative h-full min-h-0 flex flex-col p-[clamp(11px,0.95vw,22px)] gap-[clamp(10px,0.9vw,18px)]">
      {/* The song goes on the same line as "Now playing", so the video gets the room below */}
      <div className="flex min-w-0 items-center gap-[clamp(6px,0.5vw,10px)]">
        <NowPlayingIcon songId={currentVideo?.id} />
        {currentVideo && (
          <span className="min-w-0 truncate text-[clamp(13px,1vw,21px)]">
            <span className="font-semibold">{currentVideo.title}</span>
            {currentVideo.channel_title && <span className="text-muted-foreground"> · {currentVideo.channel_title}</span>}
          </span>
        )}
        {currentVideo &&
          (() => {
            const d = parseQueuedBy(currentVideo.queued_by);
            return d.to ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-[clamp(8px,0.6vw,12px)] py-[clamp(1px,0.15vw,3px)] font-medium text-[clamp(11px,0.85vw,18px)]">
                🎵 For <strong>{d.to}</strong> <span className="text-muted-foreground">from {d.from}</span>
              </span>
            ) : null;
          })()}
        {/* (⏭ and) ＋ up here on small screens, and on big ones while nothing plays; with a video they sit under it */}
        <span className={`ml-auto ${currentVideo ? "lg:hidden" : ""}`} />
        <span className={`flex items-center gap-1.5 ${currentVideo ? "lg:hidden" : ""}`}>
          {currentVideo && (
            <button
              type="button"
              onClick={skip}
              aria-label={confirmSkip ? "Click again to skip" : "Skip to the next song"}
              title={me ? "Skip to the next song" : "Skip on the Play page"}
              className={`flex h-[clamp(24px,1.7vw,36px)] shrink-0 items-center justify-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold transition-all ${confirmSkip ? "px-2.5" : "w-[clamp(24px,1.7vw,36px)]"}`}
            >
              {skipIcon}
              {confirmSkip && "Skip?"}
            </button>
          )}
          <QueueAdder me={me} onLogin={openMusic} onAdd={addSong} />
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-2 lg:gap-[clamp(8px,0.7vw,14px)]">
        {!currentVideo ? (
          // Nothing playing: musicians and text side by side, so the tile stays short
          <div
            onClick={() => navigate("/play?tab=music")}
            className={`flex-1 min-h-0 flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-[clamp(16px,1.6vw,36px)] rounded-xl text-center lg:text-left ${ACTIONABLE}`}
          >
            {/* Multiply blends the video's white into the tile colour */}
            <video
              src={partitureVideo}
              autoPlay
              loop
              muted
              playsInline
              className="h-28 lg:h-[clamp(96px,8vw,180px)] aspect-square w-auto object-contain mix-blend-multiply scale-[1.3] [mask-image:radial-gradient(closest-side,black_62%,transparent)]"
            />
            <div>
              <p className="font-medium text-xs lg:text-[clamp(16px,1.2vw,25px)]">No video playing</p>
              <p className="text-muted-foreground text-[10px] lg:text-[clamp(13px,0.9vw,19px)] mt-0.5 lg:mt-1">
                Queue one from the Play page
              </p>
            </div>
          </div>
        ) : (
          // YouTube is 16:9, so the box is too: the video fills it with no bars. The tile is as tall as
          // this box plus the queue row, and Kudos gets the rest of the column.
          <div className="relative w-full shrink-0 aspect-video max-h-[58vh]">
            <div
              ref={containerRef}
              className="absolute inset-0 bg-secondary rounded-[clamp(10px,0.9vw,18px)] overflow-hidden [&_iframe]:!h-full [&_iframe]:!w-full"
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
            {/* Dragging the queue: you need to be logged in on this screen, or the save failed */}
            {queueNote && (
              <div
                key={queueNote}
                className="absolute bottom-[clamp(8px,0.7vw,14px)] left-1/2 z-10 flex -translate-x-1/2 items-center gap-[0.8em] whitespace-nowrap rounded-full bg-[hsl(var(--card))] py-[0.4em] pl-[1em] pr-[0.4em] text-[clamp(12px,0.85vw,18px)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)] animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                {queueNote === "login" ? (
                  <>
                    <span>Log in on this screen to reorder songs</span>
                    <button type="button" onClick={openMusic} className="rounded-full bg-primary px-[0.9em] py-[0.25em] font-semibold text-primary-foreground">
                      Log in
                    </button>
                  </>
                ) : (
                  <span className="pr-[0.6em]">Couldn&rsquo;t save the new order. Try again.</span>
                )}
              </div>
            )}
            {/* Someone just added a song: a pill over the video for a few seconds */}
            {spotlight && (
              <div
                key={spotlight.id}
                className="absolute left-[clamp(8px,0.7vw,14px)] top-[clamp(8px,0.7vw,14px)] z-10 flex max-w-[80%] items-center gap-[0.6em] rounded-full bg-[hsl(var(--card))] py-[0.35em] pl-[0.35em] pr-[1em] text-[clamp(12px,0.85vw,18px)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)] animate-in fade-in slide-in-from-top-2 duration-500"
              >
                {spotlight.thumbnail_url && <img src={spotlight.thumbnail_url} alt="" className="h-[2.2em] aspect-video shrink-0 rounded-full object-cover" />}
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-primary">Just added</span> <span className="font-semibold">{spotlight.title}</span>
                  {(() => {
                    const d = parseQueuedBy(spotlight.queued_by);
                    return <span className="text-muted-foreground"> · {d.to ? `for ${d.to}, from ${d.from}` : `by ${d.from}`}</span>;
                  })()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Small screens: one line about the queue */}
        {queue.length > 0 && (
          <div className="flex lg:hidden items-center gap-2 text-xs text-muted-foreground border-t border-border pt-1.5">
            <ListMusic className="h-3.5 w-3.5" />
            <span>{queue.length} in queue</span>
            <span className="truncate">— Next: {queue[0]?.title}</span>
          </div>
        )}

        {/* Big screens: up next as a row of thumbnails, with ⏭ and ＋ at the end (while it asks "Skip?", ⏭ takes both slots) */}
        {currentVideo && (
          <div className="hidden lg:flex shrink-0 items-center gap-[clamp(6px,0.5vw,10px)]">
            <span className="shrink-0 text-muted-foreground text-[clamp(11px,0.8vw,16px)]">Up next</span>
            {queue.length === 0 ? (
              <span className="min-w-0 flex-1 truncate text-muted-foreground text-[clamp(11px,0.8vw,16px)]">Nothing queued yet</span>
            ) : (
              // Scrolls sideways when there are more than fit; on a laptop, drag to reorder
              <QueueStrip
                direction="horizontal"
                items={queue}
                canReorder={!!me}
                onLocked={() => showNote("login")}
                onReorder={(ids, onFail) =>
                  reorderQueue.mutate(ids, {
                    onError: () => {
                      onFail();
                      showNote("failed");
                    },
                  })
                }
              />
            )}
            <div className="flex w-[clamp(80px,6vw,130px)] shrink-0 gap-[clamp(4px,0.4vw,8px)]">
              <button
                type="button"
                onClick={skip}
                aria-label={confirmSkip ? "Click again to skip" : "Skip to the next song"}
                title={me ? "Skip to the next song" : "Skip on the Play page"}
                className={`flex h-[clamp(26px,1.9vw,40px)] min-w-0 flex-1 items-center justify-center gap-[0.3em] rounded-[clamp(4px,0.4vw,8px)] bg-primary text-primary-foreground font-semibold text-[clamp(11px,0.8vw,17px)] transition-colors [@media(hover:hover)]:hover:bg-primary/90 ${confirmSkip ? "animate-in fade-in duration-150" : ""}`}
              >
                {skipIcon}
                {confirmSkip && "Skip?"}
              </button>
              {!confirmSkip && (
                <div className="min-w-0 flex-1">
                  <QueueAdder variant="slot" me={me} onLogin={openMusic} onAdd={addSong} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Game how-to demos play here: the video keeps running (and sounding) underneath */}
      {gameSpotlight?.phase === "demo" && <GameDemoOverlay key={gameSpotlight.gameKey} gameKey={gameSpotlight.gameKey} />}
    </Card>
  );
}
