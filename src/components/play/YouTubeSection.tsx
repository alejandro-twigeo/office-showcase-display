import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useYoutubeQueue } from "@/hooks/useYoutubeQueue";
import { Youtube, Play, Clock, Search, Edit2, X, Check } from "lucide-react";

interface YouTubeSectionProps {
  playerName: string;
}

export function YouTubeSection({ playerName }: YouTubeSectionProps) {
  const { currentVideo, recentVideos, playVideo, updateVideo } = useYoutubeQueue();

  const [videoUrl, setVideoUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editUrl, setEditUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const userTouchedEditRef = useRef(false);

  const extractVideoId = (url: string): string | null => {
    const trimmed = url.trim();

    // Support raw video id
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

    // Support common URL formats
    const patterns = [
      /youtube\.com\/watch\?v=([^&\n?#]+)/i,
      /youtu\.be\/([^&\n?#]+)/i,
      /youtube\.com\/embed\/([^&\n?#]+)/i,
      /youtube\.com\/shorts\/([^&\n?#]+)/i,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match?.[1]) return match[1];
    }

    return null;
  };

  const getVideoTitle = async (videoId: string): Promise<string | null> => {
    // oEmbed returns title for public videos without needing an API key.
    // If the video is private/blocked, this can fail, so we fall back gracefully.
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

    try {
      const res = await fetch(oembedUrl);
      if (!res.ok) return null;
      const json = (await res.json()) as { title?: string };
      return json.title ?? null;
    } catch {
      return null;
    }
  };

  // Entering edit mode: set default value once, but do not overwrite if user starts typing.
  useEffect(() => {
    if (!isEditing) {
      userTouchedEditRef.current = false;
      setEditUrl("");
      setError(null);
      return;
    }

    if (isEditing && currentVideo && !userTouchedEditRef.current) {
      setEditUrl(`https://youtube.com/watch?v=${currentVideo.video_id}`);
    }
  }, [isEditing, currentVideo?.video_id]);

  const canPlay = useMemo(() => !!extractVideoId(videoUrl), [videoUrl]);
  const canUpdate = useMemo(() => !!extractVideoId(editUrl), [editUrl]);

  const handlePlayVideo = async () => {
    setError(null);
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      setError("Paste a valid YouTube URL or 11-character video ID.");
      return;
    }

    const title = (await getVideoTitle(videoId)) ?? `Video ${videoId}`;

    playVideo.mutate(
      { video_id: videoId, title, queued_by: playerName },
      {
        onSuccess: () => setVideoUrl(""),
        onError: () => setError("Could not start the video. Try again."),
      }
    );
  };

  const handleUpdateVideo = async () => {
    setError(null);
    const videoId = extractVideoId(editUrl);
    if (!videoId || !currentVideo) {
      setError("Paste a valid YouTube URL or 11-character video ID.");
      return;
    }

    const title = (await getVideoTitle(videoId)) ?? `Video ${videoId}`;

    updateVideo.mutate(
      { id: currentVideo.id, video_id: videoId, title },
      {
        onSuccess: () => {
          setIsEditing(false);
          userTouchedEditRef.current = false;
          setEditUrl("");
        },
        onError: () => setError("Could not update the video. Try again."),
      }
    );
  };

  const cancelEdit = () => {
    setIsEditing(false);
    userTouchedEditRef.current = false;
    setEditUrl("");
    setError(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-destructive" />
          YouTube
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current video */}
        {currentVideo && (
          <div className="bg-secondary/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Play className="h-3 w-3" />
                Now Playing
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing((v) => !v)}
                className="h-7 w-7 p-0"
                aria-label={isEditing ? "Close edit" : "Edit current video"}
              >
                {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
              </Button>
            </div>

            {isEditing ? (
              <div className="space-y-2 mt-2">
                <Input
                  placeholder="New YouTube URL or video ID..."
                  value={editUrl}
                  onChange={(e) => {
                    userTouchedEditRef.current = true;
                    setEditUrl(e.target.value);
                  }}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleUpdateVideo}
                    disabled={!canUpdate || updateVideo.isPending}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Update
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-medium line-clamp-1">{currentVideo.title}</p>
                <p className="text-xs text-muted-foreground">by {currentVideo.queued_by}</p>
              </>
            )}
          </div>
        )}

        {/* Add new video */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Paste YouTube URL or video ID..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="pl-9"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            onClick={handlePlayVideo}
            disabled={!canPlay || playVideo.isPending}
            className="w-full"
          >
            {playVideo.isPending ? "Loading..." : "Play now"}
          </Button>
        </div>

        {/* Recent videos */}
        {recentVideos.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Recently played
            </p>
            <div className="space-y-2">
              {recentVideos.slice(0, 5).map((video) => (
                <button
                  key={video.id}
                  onClick={() =>
                    playVideo.mutate({
                      video_id: video.video_id,
                      title: video.title,
                      queued_by: playerName,
                    })
                  }
                  disabled={playVideo.isPending}
                  className="w-full text-left p-2 rounded-md hover:bg-secondary/50 transition-colors"
                >
                  <p className="text-sm font-medium line-clamp-1">{video.title}</p>
                  <p className="text-xs text-muted-foreground">by {video.queued_by}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
