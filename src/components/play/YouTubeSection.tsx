import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useYoutubeQueue } from '@/hooks/useYoutubeQueue';
import { Youtube, Play, Clock, Search } from 'lucide-react';

interface YouTubeSectionProps {
  playerName: string;
}

export function YouTubeSection({ playerName }: YouTubeSectionProps) {
  const { currentVideo, recentVideos, playVideo } = useYoutubeQueue();
  const [videoUrl, setVideoUrl] = useState('');

  const extractVideoId = (url: string): string | null => {
    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handlePlayVideo = () => {
    const videoId = extractVideoId(videoUrl.trim());
    if (videoId) {
      playVideo.mutate(
        {
          video_id: videoId,
          title: `Video ${videoId}`, // In a real app, we'd fetch the title from YouTube API
          queued_by: playerName,
        },
        {
          onSuccess: () => {
            setVideoUrl('');
          },
        }
      );
    }
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Play className="h-3 w-3" />
              Now Playing
            </div>
            <p className="font-medium line-clamp-1">{currentVideo.title}</p>
            <p className="text-xs text-muted-foreground">by {currentVideo.queued_by}</p>
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
          <Button
            onClick={handlePlayVideo}
            disabled={!extractVideoId(videoUrl.trim()) || playVideo.isPending}
            className="w-full"
          >
            {playVideo.isPending ? 'Loading...' : 'Play Now'}
          </Button>
        </div>

        {/* Recent videos */}
        {recentVideos.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Recently Played
            </p>
            <div className="space-y-2">
              {recentVideos.slice(0, 5).map((video) => (
                <button
                  key={video.id}
                  onClick={() => {
                    playVideo.mutate({
                      video_id: video.video_id,
                      title: video.title,
                      queued_by: playerName,
                    });
                  }}
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
