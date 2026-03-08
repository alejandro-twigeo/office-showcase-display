import { useEffect, useRef, useCallback } from "react";

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
  destroy: () => void;
};

const ytAPIReadyCallbacks: Array<() => void> = [];
let ytAPILoaded = false;

function loadYouTubeAPI(onReady: () => void) {
  ytAPIReadyCallbacks.push(onReady);
  if (ytAPILoaded) return;
  ytAPILoaded = true;

  if (window.YT?.Player) {
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

interface PrivatePlayerProps {
  videoId: string | undefined;
  onEnded: () => void;
}

export function PrivatePlayer({ videoId, onEnded }: PrivatePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const playerReadyRef = useRef(false);
  const pendingVideoIdRef = useRef<string | undefined>(undefined);
  const hasEndedRef = useRef(false);

  const handleEnd = useCallback(() => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    onEnded();
  }, [onEnded]);

  useEffect(() => {
    hasEndedRef.current = false;
  }, [videoId]);

  useEffect(() => {
    if (!videoId) {
      playerRef.current?.destroy();
      playerRef.current = null;
      playerReadyRef.current = false;
      return;
    }

    const init = () => {
      if (!containerRef.current) return;

      if (playerRef.current && playerReadyRef.current) {
        playerRef.current.loadVideoById(videoId);
        setTimeout(() => playerRef.current?.playVideo(), 300);
        return;
      }

      if (playerRef.current && !playerReadyRef.current) {
        pendingVideoIdRef.current = videoId;
        return;
      }

      const div = document.createElement("div");
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(div);
      pendingVideoIdRef.current = undefined;
      playerReadyRef.current = false;

      playerRef.current = new window.YT.Player(div, {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: { autoplay: 1, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            playerRef.current?.playVideo();
            if (pendingVideoIdRef.current && pendingVideoIdRef.current !== videoId) {
              playerRef.current?.loadVideoById(pendingVideoIdRef.current);
              setTimeout(() => playerRef.current?.playVideo(), 300);
              pendingVideoIdRef.current = undefined;
            }
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === 0) handleEnd();
          },
        },
      });
    };

    loadYouTubeAPI(init);
    if (window.YT?.Player) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      playerReadyRef.current = false;
    };
  }, []);

  if (!videoId) return null;

  return (
    <div className="w-full aspect-video rounded-lg overflow-hidden bg-secondary">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
