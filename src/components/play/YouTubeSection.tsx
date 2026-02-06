import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useYoutubeQueue } from '@/hooks/useYoutubeQueue';
import { Youtube, Play, Clock, Search, Edit2, X, Check } from 'lucide-react';

interface YouTubeSectionProps {
  playerName: string;
}

export function YouTubeSection({ playerName }: YouTubeSectionProps) {
  const { currentVideo, recentVideos, playVideo, updateVideo } = useYoutubeQueue();
  const [videoUrl, setVideoUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editUrl, setEditUrl] = useState('');

  // Populate edit field when entering edit mode
  useEffect(() => {
    if (isEditing && currentVideo) {
      setEditUrl(`https://youtube.com/watch?v=${currentVideo.video_id}`);
    }
  }, [isEditing, currentVideo]);

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
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
          title: `Video ${videoId}`,
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

  const handleUpdateVideo = () => {
    const videoId = extractVideoId(editUrl.trim());
    if (videoId && currentVideo) {
      updateVideo.mutate(
        {
          id: currentVideo.id,
          video_id: videoId,
          title: `Video ${videoId}`,
        },
        {
          onSuccess: () => {
            setIsEditing(false);
            setEditUrl('');
          },
        }
      );
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditUrl('');
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
                onClick={() => setIsEditing(!isEditing)}
                className="h-7 w-7 p-0"
              >
                {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
              </Button>
            </div>
            
            {isEditing ? (
              <div className="space-y-2 mt-2">
                <Input
                  placeholder="New YouTube URL..."
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleUpdateVideo}
                    disabled={!extractVideoId(editUrl.trim()) || updateVideo.isPending}
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
