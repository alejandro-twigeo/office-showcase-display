import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useYoutubeQueue } from "@/hooks/useYoutubeQueue";
import { Youtube, Play, ListMusic, Search, Trash2, Clock, User } from "lucide-react";

interface YouTubeSectionProps {
  playerName: string;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function YouTubeSection({ playerName }: YouTubeSectionProps) {
  const { currentVideo, queue, recentVideos, playNow, addToQueue, removeFromQueue, toggleFavorite } =
    useYoutubeQueue();

  const [videoUrl, setVideoUrl] = useState("");
  const isPending = playNow.isPending || addToQueue.isPending;
  const videoId = extractVideoId(videoUrl.trim());

  const handlePlayNow = () => {
    if (!videoId) return;
    playNow.mutate({ video_id: videoId, queued_by: playerName }, { onSuccess: () => setVideoUrl("") });
  };

  const handleAddToQueue = () => {
    if (!videoId) return;
    addToQueue.mutate({ video_id: videoId, queued_by: playerName }, { onSuccess: () => setVideoUrl("") });
  };

  const handleReplay = (vid: { video_id: string }) => {
    playNow.mutate({ video_id: vid.video_id, queued_by: playerName });
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
        {/* Now Playing */}
        {currentVideo && (
          <div className="bg-secondary/30 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Play className="h-3 w-3 fill-current text-primary" />
              <span className="text-primary font-medium">Now Playing</span>
            </div>
            <p className="font-medium line-clamp-1 text-sm">{currentVideo.title}</p>
            <p className="text-xs text-muted-foreground">by {currentVideo.queued_by}</p>
          </div>
        )}

        {/* URL Input */}
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

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handlePlayNow}
              disabled={!videoId || isPending}
              variant="default"
              className="w-full"
            >
              <Play className="h-4 w-4 mr-1" />
              {playNow.isPending ? "Loading..." : "Play Now"}
            </Button>
            <Button
              onClick={handleAddToQueue}
              disabled={!videoId || isPending}
              variant="outline"
              className="w-full"
            >
              <ListMusic className="h-4 w-4 mr-1" />
              {addToQueue.isPending ? "Adding..." : "Add to Queue"}
            </Button>
          </div>
        </div>

        {/* Queue */}
        {queue.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <ListMusic className="h-3 w-3" />
              Up Next ({queue.length})
            </p>
            <div className="space-y-1">
              {queue.map((video, idx) => (
                <div
                  key={video.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-secondary/20 border border-border/50"
                >
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                  <img
                    src={video.thumbnail_url ?? `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                    alt={video.title}
                    className="h-8 w-12 rounded object-cover bg-secondary shrink-0"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium line-clamp-1">{video.title}</p>
                    <p className="text-xs text-muted-foreground">by {video.queued_by}</p>
                  </div>
                  {video.queued_by === playerName && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeFromQueue.mutate(video.id)}
                      aria-label="Remove from queue"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recently Played */}
        {recentVideos.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Recently Played
            </p>
            <div className="space-y-1">
              {recentVideos.slice(0, 5).map((video) => (
                <div
                  key={video.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/40 transition-colors"
                >
                  <button
                    onClick={() => handleReplay(video)}
                    disabled={playNow.isPending}
                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                  >
                    <img
                      src={video.thumbnail_url ?? `https://img.youtube.com/vi/${video.video_id}/hqdefault.jpg`}
                      alt={video.title}
                      className="h-8 w-12 rounded object-cover bg-secondary shrink-0"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium line-clamp-1">{video.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        {video.queued_by}
                      </p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
